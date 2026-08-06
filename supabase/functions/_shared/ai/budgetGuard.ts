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
 * Daily $ caps. Purpose: stop a single-day runaway (bug, abuse, loop) before
 * it eats the whole month's allowance. Sized ~10x above observed per-user
 * spend (heaviest real user: ~$0.29/active day) so normal use never hits them.
 *   free     $0.00/mo  → $0.15/day
 *   buyer    $9.97/mo  → $0.60/day
 *   investor $24.97/mo → $1.50/day
 */
const DEFAULT_LIMITS: BudgetLimits = { free: 0.15, buyer: 0.6, investor: 1.5 };

/**
 * Per-tier monthly USD ceiling. Purpose: protect margin across the billing
 * period. Intentionally BELOW daily × 30 — the daily cap bounds one bad day,
 * the monthly cap bounds the month.
 *   free     $1 / month
 *   buyer    $10 / month   (subscription $9.97/mo)
 *   investor $25 / month   (subscription $24.97/mo)
 */
const DEFAULT_MONTHLY_LIMITS: BudgetLimits = { free: 1, buyer: 10, investor: 25 };

function envNum(name: string, fallback: number): number {
  const v = Deno.env.get(name);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getBudgetLimits(): BudgetLimits {
  return {
    free: envNum("DAILY_CAP_FREE_USD", envNum("AI_BUDGET_FREE_USD", DEFAULT_LIMITS.free)),
    buyer: envNum("DAILY_CAP_BUYER_USD", envNum("AI_BUDGET_BUYER_USD", DEFAULT_LIMITS.buyer)),
    investor: envNum("DAILY_CAP_INVESTOR_USD", envNum("AI_BUDGET_INVESTOR_USD", DEFAULT_LIMITS.investor)),
  };
}

export function getMonthlyBudgetLimits(): BudgetLimits {
  return {
    free: envNum("MONTHLY_CAP_FREE_USD", envNum("AI_BUDGET_MONTHLY_FREE_USD", DEFAULT_MONTHLY_LIMITS.free)),
    buyer: envNum("MONTHLY_CAP_BUYER_USD", envNum("AI_BUDGET_MONTHLY_BUYER_USD", DEFAULT_MONTHLY_LIMITS.buyer)),
    investor: envNum("MONTHLY_CAP_INVESTOR_USD", envNum("AI_BUDGET_MONTHLY_INVESTOR_USD", DEFAULT_MONTHLY_LIMITS.investor)),
  };
}

export type CapType = "daily" | "monthly";

export class BudgetExceededError extends Error {
  constructor(
    public readonly tier: Tier,
    public readonly usedUsd: number,
    public readonly capUsd: number,
    public readonly surface?: SurfaceId,
    public readonly resetAt: string = nextUtcMidnightIso(),
    public readonly capType: CapType = "daily",
    public readonly monthlyUsedUsd: number = 0,
    public readonly monthlyCapUsd: number = 0,
  ) {
    super(`${capType === "monthly" ? "Monthly" : "Daily"} AI budget exceeded for tier=${tier}: used $${usedUsd.toFixed(4)} of $${capUsd.toFixed(2)}`);
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
  /** Set when the user is an internal/staff account — caps fully bypassed. */
  isStaff?: boolean;
  /** Which cap a BudgetExceededError would describe (only set on failure). */
  capType?: CapType;
  monthlyUsedUsd?: number;
  monthlyCapUsd?: number;
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
  isDevCall: boolean = false,
): Promise<number> {
  if (!client || !userId) return 0;
  const today = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
  const { data, error } = await client
    .from("ai_usage_log")
    .select("cost_usd")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .eq("is_dev_call", isDevCall);
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

/**
 * Returns this month's spend (UTC) in USD for the given user. First day
 * of the current UTC month → now. Fail-open on errors.
 */
export async function getMonthSpendUsd(
  userId: string,
  client: SupabaseClient | null = getServiceClient(),
  isDevCall: boolean = false,
): Promise<number> {
  if (!client || !userId) return 0;
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const { data, error } = await client
    .from("ai_usage_log")
    .select("cost_usd")
    .eq("user_id", userId)
    .gte("usage_date", firstOfMonth)
    .eq("is_dev_call", isDevCall);
  if (error) {
    console.error("[ai-router] monthly budget read failed:", error.message);
    return 0;
  }
  let total = 0;
  for (const row of (data ?? []) as Array<{ cost_usd: number | string | null }>) {
    const v = typeof row.cost_usd === "string" ? Number(row.cost_usd) : row.cost_usd;
    if (typeof v === "number" && Number.isFinite(v)) total += v;
  }
  return total;
}

/** Per-request staff lookup. Best-effort; defaults false. */
export async function isStaffUser(
  userId: string,
  client: SupabaseClient | null = getServiceClient(),
): Promise<boolean> {
  if (!client || !userId) return false;
  const { data, error } = await client
    .from("profiles")
    .select("is_staff")
    .eq("id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean((data as { is_staff?: boolean } | null)?.is_staff);
}

export async function checkBudget(
  userId: string,
  tier: Tier,
  opts: {
    client?: SupabaseClient | null;
    limits?: BudgetLimits;
    monthlyLimits?: BudgetLimits;
    isDevCall?: boolean;
  } = {},
): Promise<BudgetStatus> {
  const limits = opts.limits ?? getBudgetLimits();
  const monthlyLimits = opts.monthlyLimits ?? getMonthlyBudgetLimits();
  const capUsd = limits[tier];
  const monthlyCap = monthlyLimits[tier];
  // Bypass: allow when budgeting is disabled or no userId attached.
  if (!userId || Deno.env.get("AI_BUDGET_DISABLED") === "1") {
    return { allowed: true, tier, usedUsd: 0, capUsd, remainingUsd: capUsd };
  }
  const client = opts.client ?? getServiceClient();
  // Staff bypass — internal accounts have no caps.
  if (await isStaffUser(userId, client)) {
    return {
      allowed: true,
      tier,
      usedUsd: 0,
      capUsd,
      remainingUsd: capUsd,
      isStaff: true,
    };
  }
  const [usedUsd, monthlyUsed] = await Promise.all([
    getTodaySpendUsd(userId, client, opts.isDevCall ?? false),
    getMonthSpendUsd(userId, client, opts.isDevCall ?? false),
  ]);
  const overDaily = usedUsd >= capUsd;
  const overMonthly = monthlyUsed >= monthlyCap;
  if (!overDaily && !overMonthly) {
    return {
      allowed: true,
      tier,
      usedUsd,
      capUsd,
      remainingUsd: Math.max(0, capUsd - usedUsd),
      monthlyUsedUsd: monthlyUsed,
      monthlyCapUsd: monthlyCap,
    };
  }
  // Over daily and/or monthly cap — see if credits can cover.
  // Free users never get credits, so skip the lookup.
  const capType: CapType = overMonthly ? "monthly" : "daily";
  if (tier === "free") {
    return {
      allowed: false,
      tier,
      usedUsd,
      capUsd,
      remainingUsd: 0,
      capType,
      monthlyUsedUsd: monthlyUsed,
      monthlyCapUsd: monthlyCap,
    };
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
      monthlyUsedUsd: monthlyUsed,
      monthlyCapUsd: monthlyCap,
    };
  }
  return {
    allowed: false,
    tier,
    usedUsd,
    capUsd,
    remainingUsd: 0,
    creditsBalanceUsd: 0,
    capType,
    monthlyUsedUsd: monthlyUsed,
    monthlyCapUsd: monthlyCap,
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

/** ISO timestamp at the first day of next month (UTC midnight). */
export function firstOfNextMonthIso(now: Date = new Date()): string {
  const reset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1,
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

function friendlyMessage(tier: Tier, capType: CapType = "daily", resetAtIso?: string): string {
  if (capType === "monthly") {
    const display = DISPLAY_NAME[tier];
    const resetDate = resetAtIso ? new Date(resetAtIso) : new Date();
    const resetLabel = resetDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    if (tier === "free") {
      return `You've used this month's free assistant credits. Upgrade for more or come back ${resetLabel}.`;
    }
    if (tier === "investor") {
      return `You've used this month's Investor allowance — most users don't reach this. Resets ${resetLabel}.`;
    }
    return `You've used this month's ${display} assistant credits. Resets ${resetLabel}.`;
  }
  if (tier === "free") {
    return "You've used today's free assistant credits. Upgrade for more or try again tomorrow.";
  }
  if (tier === "buyer") {
    return "You've hit today's Buyer assistant cap. Upgrade to Investor or try again tomorrow.";
  }
  return "You've used today's Investor cap — most users don't reach this. Resets at midnight.";
}

export interface BudgetExceededPayload {
  error: "budget_exceeded";
  tier: Tier;
  tier_display: string;
  surface?: SurfaceId;
  message: string;
  cap_type: CapType;
  usage_today_usd: number;
  daily_limit_usd: number;
  usage_month_usd: number;
  monthly_limit_usd: number;
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
  const resetAt = err.capType === "monthly" ? firstOfNextMonthIso() : err.resetAt;
  return {
    error: "budget_exceeded",
    tier: err.tier,
    tier_display: DISPLAY_NAME[err.tier],
    surface: err.surface,
    message: friendlyMessage(err.tier, err.capType, resetAt),
    cap_type: err.capType,
    usage_today_usd: Number(err.usedUsd.toFixed(4)),
    daily_limit_usd: err.capUsd,
    usage_month_usd: Number(err.monthlyUsedUsd.toFixed(4)),
    monthly_limit_usd: err.monthlyCapUsd,
    credits_balance_usd: creditsBalanceUsd,
    reset_at: resetAt,
    upgrade,
    topup,
  };
}

export function tierDailyLimitUsd(tier: Tier): number {
  return getBudgetLimits()[tier];
}

export function tierMonthlyLimitUsd(tier: Tier): number {
  return getMonthlyBudgetLimits()[tier];
}