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

/** Per-tier daily USD ceiling. Overridable via env. */
export interface BudgetLimits {
  free: number;
  paid: number;
  premium: number;
}

/**
 * Daily $ caps sized to the current subscription prices and Sonnet's
 * ~$0.020 per typical turn cost. See homelens_sonnet_all_tiers_fix_prompt
 * for the pricing math.
 *   free    $0.00/mo  → $0.10/day  (~5 turns/day)
 *   paid    $9.97/mo  → $0.50/day  (~25 turns/day)
 *   premium $24.97/mo → $1.50/day  (~75 turns/day)
 */
const DEFAULT_LIMITS: BudgetLimits = { free: 0.10, paid: 0.50, premium: 1.50 };

function envNum(name: string, fallback: number): number {
  const v = Deno.env.get(name);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getBudgetLimits(): BudgetLimits {
  return {
    free: envNum("AI_BUDGET_FREE_USD", DEFAULT_LIMITS.free),
    paid: envNum("AI_BUDGET_PAID_USD", DEFAULT_LIMITS.paid),
    premium: envNum("AI_BUDGET_PREMIUM_USD", DEFAULT_LIMITS.premium),
  };
}

export class BudgetExceededError extends Error {
  constructor(
    public readonly tier: Tier,
    public readonly usedUsd: number,
    public readonly capUsd: number,
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
  const usedUsd = await getTodaySpendUsd(
    userId,
    opts.client ?? getServiceClient(),
  );
  return {
    allowed: usedUsd < capUsd,
    tier,
    usedUsd,
    capUsd,
    remainingUsd: Math.max(0, capUsd - usedUsd),
  };
}