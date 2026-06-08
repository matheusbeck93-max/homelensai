/**
 * Daily budget guard for the AI router.
 *
 * Reads the user's cost-so-far for today (UTC) from `ai_usage_log` and
 * compares it against a per-tier USD cap. Failure modes are intentionally
 * permissive: if the DB read fails or no service client is available, we
 * allow the call (logged) — telemetry/guard must never strand a user.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { Tier } from "./types.ts";
import type { SurfaceId } from "./surfaceConfig.ts";
import { getActiveCreditBalance, getCreditPacks, getPlanCreditBalance } from "../credits.ts";

/** Per-tier daily USD ceiling. Overridable via env. */
export interface BudgetLimits {
  free: number;
  buyer: number;
  investor: number;
}

/**
 * Daily $ caps sized to the current subscription prices and Sonnet's
 * ~$0.020 per typical turn cost. See homelens_sonnet_all_tiers_fix_prompt
 * for the pricing math.
 *   free     $0.00/mo  → $0.10/day  (~5 turns/day)
 *   buyer    $9.97/mo  → $0.50/day  (~25 turns/day)
 *   investor $24.97/mo → $1.50/day  (~75 turns/day)
 */
const DEFAULT_LIMITS: BudgetLimits = { free: 0.10, buyer: 0.50, investor: 1.50 };

function envNum(name: string, fallback: number): number {
  const v = Deno.env.get(name);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getBudgetLimits(): BudgetLimits {
  return {
    free: envNum("AI_BUDGET_FREE_USD", DEFAULT_LIMITS.free),
    buyer: envNum("AI_BUDGET_BUYER_USD", DEFAULT_LIMITS.buyer),
    investor: envNum("AI_BUDGET_INVESTOR_USD", DEFAULT_LIMITS.investor),
  };
}

export class BudgetExceededError extends Error {
  constructor(
    public readonly tier: Tier,
    public readonly usedUsd: number,
    public readonly capUsd: number,
    public readonly surface?: SurfaceId,
    public readonly resetAt: string = nextUtcMidnightIso(),
  ) {
    super(`Daily AI budget exceeded for tier=${tier}: used $${usedUsd.toFixed(4)} of $${capUsd.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}

export interface BudgetStatus {
  allowed: boolean;
  tier: Tier;
  usedUsd: number;
  capUsd: number;
  remainingUsd: number;
  /** True when the call was admitted against the user's credit balance. */
  usedCredits?: boolean;
  /** Active credit balance at decision time (best-effort). */
  creditsBalanceUsd?: number;
}

let cachedClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/**
 * Returns today's spend (UTC) in USD for the given user. Returns 0 on
 * missing-client or read failure (fail-open).
 */
export async function getTodaySpendUsd(
  userId: string,
  client: SupabaseClient | null = getServiceClient(),
): Promise<number> {
  if (!client || !userId) return 0;
  const today = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
  const { data, error } = await client
    .from("ai_usage_log")
    .select("cost_usd")
    .eq("user_id", userId)
    .eq("usage_date", today);
  if (error) {
    console.error("[ai-router] budget read failed:", error.message);
    return 0;
  }
  let total = 0;
  for (const row of (data ?? []) as Array<{ cost_usd: number | string | null }>) {
    const v = typeof row.cost_usd === "string" ? Number(row.cost_usd) : row.cost_usd;
    if (typeof v === "number" && Number.isFinite(v)) total += v;
  }
  return total;
}

export async function checkBudget(
  userId: string,
  tier: Tier,
  opts: { client?: SupabaseClient | null; limits?: BudgetLimits } = {},
): Promise<BudgetStatus> {
  const limits = opts.limits ?? getBudgetLimits();
  const capUsd = limits[tier];
  // Bypass: allow when budgeting is disabled or no userId attached.
  if (!userId || Deno.env.get("AI_BUDGET_DISABLED") === "1") {
    return { allowed: true, tier, usedUsd: 0, capUsd, remainingUsd: capUsd };
  }
  const client = opts.client ?? getServiceClient();
  const usedUsd = await getTodaySpendUsd(userId, client);
  if (usedUsd < capUsd) {
    return {
      allowed: true,
      tier,
      usedUsd,
      capUsd,
      remainingUsd: Math.max(0, capUsd - usedUsd),
    };
  }
  // Over the daily cap — see if active credits can cover this turn.
  // Free users never get credits, so skip the lookup.
  if (tier === "free") {
    return { allowed: false, tier, usedUsd, capUsd, remainingUsd: 0 };
  }
  const [topup, plan] = await Promise.all([
    getActiveCreditBalance(userId, client),
    getPlanCreditBalance(userId, client),
  ]);
  const combined = topup.balanceUsd + plan.remainingUsd;
  if (combined > 0) {
    return {
      allowed: true,
      tier,
      usedUsd,
      capUsd,
      remainingUsd: 0,
      usedCredits: true,
      creditsBalanceUsd: Number(combined.toFixed(4)),
    };
  }
  return {
    allowed: false,
    tier,
    usedUsd,
    capUsd,
    remainingUsd: 0,
    creditsBalanceUsd: 0,
  };
}

/**
 * ISO timestamp at the next UTC midnight. Used both for the structured
 * 402 payload and for the budget-status endpoint so the client can render
 * a single countdown.
 */
export function nextUtcMidnightIso(now: Date = new Date()): string {
  const reset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return reset.toISOString();
}

/**
 * User-facing tier names + upgrade map. Backend `Tier` (paid/premium) is
 * translated into the rebrand (Buyer/Investor) for the response payload
 * the frontend renders. When the tier migration lands the names converge.
 */
const DISPLAY_NAME: Record<Tier, string> = {
  free: "Free",
  buyer: "Buyer",
  investor: "Investor",
};

const UPGRADE_NEXT: Record<Tier, Tier | null> = {
  free: "buyer",       // Free → Buyer
  buyer: "investor",   // Buyer → Investor
  investor: null,      // Investor is the top tier today
};

const TIER_PRICE_USD: Record<Tier, number> = {
  free: 0,
  buyer: 9.97,
  investor: 24.97,
};

function friendlyMessage(tier: Tier): string {
  if (tier === "free") {
    return "You've used today's free assistant credits. Upgrade for more or try again tomorrow.";
  }
  if (tier === "buyer") {
    return "You've hit today's Buyer assistant cap. Upgrade to Investor or try again tomorrow.";
  }
  // investor
  return "You've used today's Investor cap — most users don't reach this. Resets at midnight.";
}

export interface BudgetExceededPayload {
  error: "budget_exceeded";
  tier: Tier;
  tier_display: string;
  surface?: SurfaceId;
  message: string;
  usage_today_usd: number;
  daily_limit_usd: number;
  credits_balance_usd: number;
  reset_at: string;
  upgrade:
    | {
        available: true;
        next_tier: Tier;
        next_tier_display: string;
        next_tier_price_usd: number;
        checkout_url: string;
      }
    | {
        available: false;
        next_tier: null;
        next_tier_display: null;
        next_tier_price_usd: null;
        checkout_url: null;
      };
  topup:
    | {
        available: true;
        packs: Array<{
          size: "small" | "medium" | "large";
          price_usd: number;
          credit_usd: number;
          bonus_pct: number;
        }>;
      }
    | {
        available: false;
        packs: [];
      };
}

/**
 * Structured 402 body for cap-hit. Frontend `useBudgetCap` parses this and
 * pushes the state across every AI surface in the app.
 */
export async function buildBudgetExceededPayload(
  err: BudgetExceededError,
): Promise<BudgetExceededPayload> {
  const next = UPGRADE_NEXT[err.tier];
  const upgrade: BudgetExceededPayload["upgrade"] = next
    ? {
        available: true,
        next_tier: next,
        next_tier_display: DISPLAY_NAME[next],
        next_tier_price_usd: TIER_PRICE_USD[next],
        checkout_url: `/pricing?plan=${next}&source=cap_hit_${err.surface ?? "general"}`,
      }
    : {
        available: false,
        next_tier: null,
        next_tier_display: null,
        next_tier_price_usd: null,
        checkout_url: null,
      };
  // Free users never see top-up packs — funnel them to upgrade instead.
  const topup: BudgetExceededPayload["topup"] = err.tier === "free"
    ? { available: false, packs: [] }
    : {
        available: true,
        packs: getCreditPacks().map((p) => ({
          size: p.size,
          price_usd: p.priceUsd,
          credit_usd: p.creditUsd,
          bonus_pct: Math.round(((p.creditUsd - p.priceUsd) / p.priceUsd) * 100),
        })),
      };
  // By definition we got a BudgetExceededError because both the daily cap
  // was hit AND credits returned 0 — so the live balance at this moment
  // is 0. The frontend re-reads `/budget-status` after a top-up.
  const creditsBalanceUsd = 0;
  return {
    error: "budget_exceeded",
    tier: err.tier,
    tier_display: DISPLAY_NAME[err.tier],
    surface: err.surface,
    message: friendlyMessage(err.tier),
    usage_today_usd: Number(err.usedUsd.toFixed(4)),
    daily_limit_usd: err.capUsd,
    credits_balance_usd: creditsBalanceUsd,
    reset_at: err.resetAt,
    upgrade,
    topup,
  };
}

export function tierDailyLimitUsd(tier: Tier): number {
  return getBudgetLimits()[tier];
}