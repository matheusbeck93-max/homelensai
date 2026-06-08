/**
 * AI credit helpers — shared by the budget guard, Stripe webhook, and the
 * `buy-credits` / `budget-status` edge functions.
 *
 * Two buckets, consumed in this order:
 *   1. Plan credits (monthly allowance) — stored on `profiles`. Reset to
 *      the tier allowance at every Stripe billing-cycle rollover. No
 *      rollover of unused balance.
 *   2. Top-up credits — one-time Stripe purchases in `user_credits`,
 *      consumed FIFO, expiring 90 days after purchase.
 *
 * Daily caps in `budgetGuard.ts` still apply on top — credits cover spend
 * once today's per-tier cap is reached.
 */

/** Top-up credit expiry window. */
export const TOPUP_CREDIT_EXPIRY_DAYS = 90;

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type CreditPackSize = "small" | "medium" | "large";

export interface CreditPack {
  size: CreditPackSize;
  /** What the user pays Stripe. */
  priceUsd: number;
  /** What they get added to their AI balance (includes bonus). */
  creditUsd: number;
  /** Stripe Price ID (env-pinned, swappable per environment). */
  stripePriceId: string | null;
}

/**
 * Pack catalog. Price IDs come from env so swapping Stripe environments
 * is config-only (no code change required).
 */
export function getCreditPacks(): CreditPack[] {
  return [
    {
      size: "small",
      priceUsd: 5,
      creditUsd: 5,
      stripePriceId: Deno.env.get("STRIPE_CREDIT_PACK_SMALL_PRICE_ID") ?? null,
    },
    {
      size: "medium",
      priceUsd: 10,
      creditUsd: 11,
      stripePriceId: Deno.env.get("STRIPE_CREDIT_PACK_MEDIUM_PRICE_ID") ?? null,
    },
    {
      size: "large",
      priceUsd: 25,
      creditUsd: 30,
      stripePriceId: Deno.env.get("STRIPE_CREDIT_PACK_LARGE_PRICE_ID") ?? null,
    },
  ];
}

export function getCreditPack(size: CreditPackSize): CreditPack | undefined {
  return getCreditPacks().find((p) => p.size === size);
}

/** Map a Stripe Price ID back to a pack — used by the webhook. */
export function getCreditPackByPriceId(priceId: string | null | undefined): CreditPack | undefined {
  if (!priceId) return undefined;
  return getCreditPacks().find((p) => p.stripePriceId === priceId);
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

interface CreditRow {
  id: string;
  amount_usd: number | string;
  consumed_usd: number | string;
  expires_at: string;
  status: string;
  purchased_at: string;
}

function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Active (non-expired, non-exhausted) credit rows for the user, oldest
 * first. Used both for the balance display and the FIFO consumption path.
 */
async function loadActiveCreditRows(
  userId: string,
  client: SupabaseClient,
): Promise<CreditRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("user_credits")
    .select("id, amount_usd, consumed_usd, expires_at, status, purchased_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .order("purchased_at", { ascending: true });
  if (error) {
    console.error("[credits] load active rows failed:", error.message);
    return [];
  }
  return (data ?? []) as CreditRow[];
}

export interface CreditBalance {
  balanceUsd: number;
  /** Earliest expiration of any active credit row (for the UI hint). */
  nextExpiresAt: string | null;
}

export async function getActiveCreditBalance(
  userId: string,
  client: SupabaseClient | null = getServiceClient(),
): Promise<CreditBalance> {
  if (!client || !userId) return { balanceUsd: 0, nextExpiresAt: null };
  const rows = await loadActiveCreditRows(userId, client);
  let balance = 0;
  let next: string | null = null;
  for (const r of rows) {
    balance += Math.max(0, toNum(r.amount_usd) - toNum(r.consumed_usd));
    if (!next || r.expires_at < next) next = r.expires_at;
  }
  return { balanceUsd: Number(balance.toFixed(4)), nextExpiresAt: next };
}

/**
 * Plan credits live on `profiles.plan_credits_remaining_usd` (current cycle
 * remaining) and `plan_credits_allowance_usd` (snapshot of this cycle's
 * allowance — used for "X of Y used" UI). The Stripe webhook resets
 * remaining = allowance on every billing-cycle rollover; no rollover of
 * unused balance.
 */
export interface PlanCreditBalance {
  remainingUsd: number;
  allowanceUsd: number;
}

export async function getPlanCreditBalance(
  userId: string,
  client: SupabaseClient | null = getServiceClient(),
): Promise<PlanCreditBalance> {
  if (!client || !userId) return { remainingUsd: 0, allowanceUsd: 0 };
  const { data } = await client
    .from("profiles")
    .select("plan_credits_remaining_usd, plan_credits_allowance_usd")
    .eq("id", userId)
    .maybeSingle();
  return {
    remainingUsd: toNum(data?.plan_credits_remaining_usd),
    allowanceUsd: toNum(data?.plan_credits_allowance_usd),
  };
}

/**
 * Consume credits in order: plan credits first (from profiles), then
 * top-up rows (FIFO). Returns the combined remaining balance.
 */
export async function consumeAnyCredits(
  userId: string,
  amountUsd: number,
  client: SupabaseClient | null = getServiceClient(),
): Promise<number> {
  if (!client || !userId || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return 0;
  }
  let remaining = amountUsd;
  try {
    const plan = await getPlanCreditBalance(userId, client);
    if (plan.remainingUsd > 0) {
      const take = Math.min(plan.remainingUsd, remaining);
      const newRemaining = Number((plan.remainingUsd - take).toFixed(4));
      const { error } = await client
        .from("profiles")
        .update({ plan_credits_remaining_usd: newRemaining })
        .eq("id", userId);
      if (!error) {
        remaining -= take;
        void client.from("topup_events").insert({
          user_id: userId,
          event_type: "consumed",
          price_usd: null,
          credit_usd: Number(take.toFixed(4)),
          remaining_balance_usd: newRemaining,
        });
      }
    }
    if (remaining > 0) {
      // Top-up FIFO fallback (already logs its own telemetry).
      await consumeCredits(userId, remaining, client);
    }
    const topup = await getActiveCreditBalance(userId, client);
    const planAfter = await getPlanCreditBalance(userId, client);
    return Number((topup.balanceUsd + planAfter.remainingUsd).toFixed(4));
  } catch (e) {
    console.error("[credits] consumeAnyCredits error:", (e as Error)?.message);
    return 0;
  }
}

/**
 * Consume `amountUsd` from the user's active credit rows, oldest first.
 * Spills across rows when a single row can't cover the amount. Marks
 * fully-drained rows as `exhausted`. Fire-and-forget safe — never throws.
 *
 * Returns the remaining balance after consumption (best-effort).
 */
export async function consumeCredits(
  userId: string,
  amountUsd: number,
  client: SupabaseClient | null = getServiceClient(),
): Promise<number> {
  if (!client || !userId || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return 0;
  }
  try {
    const rows = await loadActiveCreditRows(userId, client);
    let remaining = amountUsd;
    for (const r of rows) {
      if (remaining <= 0) break;
      const rowAvail = Math.max(0, toNum(r.amount_usd) - toNum(r.consumed_usd));
      if (rowAvail <= 0) continue;
      const take = Math.min(remaining, rowAvail);
      const newConsumed = toNum(r.consumed_usd) + take;
      const exhausted = newConsumed >= toNum(r.amount_usd) - 1e-6;
      const { error } = await client
        .from("user_credits")
        .update({
          consumed_usd: Number(newConsumed.toFixed(4)),
          status: exhausted ? "exhausted" : "active",
        })
        .eq("id", r.id);
      if (error) {
        console.error("[credits] consume update failed:", error.message);
        continue;
      }
      remaining -= take;
    }
    const balance = await getActiveCreditBalance(userId, client);
    // Fire-and-forget telemetry.
    void client.from("topup_events").insert({
      user_id: userId,
      event_type: "consumed",
      price_usd: null,
      credit_usd: Number((amountUsd - Math.max(0, remaining)).toFixed(4)),
      remaining_balance_usd: balance.balanceUsd,
    });
    return balance.balanceUsd;
  } catch (e) {
    console.error("[credits] consumeCredits error:", (e as Error)?.message);
    return 0;
  }
}

/**
 * Background sweep that flips expired rows to `expired`. Safe to call
 * from a cron job; idempotent.
 */
export async function expireOldCredits(
  client: SupabaseClient | null = getServiceClient(),
): Promise<number> {
  if (!client) return 0;
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("user_credits")
    .update({ status: "expired" })
    .eq("status", "active")
    .lte("expires_at", nowIso)
    .select("id, user_id, amount_usd, consumed_usd");
  if (error) {
    console.error("[credits] expire sweep failed:", error.message);
    return 0;
  }
  for (const r of (data ?? []) as Array<{ user_id: string; amount_usd: number | string; consumed_usd: number | string }>) {
    const expired = Math.max(0, toNum(r.amount_usd) - toNum(r.consumed_usd));
    if (expired > 0) {
      await client.from("topup_events").insert({
        user_id: r.user_id,
        event_type: "expired",
        credit_usd: Number(expired.toFixed(4)),
      });
    }
  }
  return data?.length ?? 0;
}