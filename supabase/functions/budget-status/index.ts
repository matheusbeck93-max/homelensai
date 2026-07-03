/**
 * GET /functions/v1/budget-status
 *
 * Returns the caller's daily AI spend rollup so the frontend can render
 * the "approaching cap" warning before any 402 fires. Reads the cached
 * `ai_usage_log` rows for today (UTC date) and joins them against the
 * per-tier daily limit defined in `_shared/ai/budgetGuard.ts`.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { handleCors, buildCorsHeaders } from "../_shared/cors.ts";
import {
  getBudgetLimits,
  getMonthlyBudgetLimits,
  getMonthSpendUsd,
  firstOfNextMonthIso,
  nextUtcMidnightIso,
} from "../_shared/ai/budgetGuard.ts";
import { getActiveCreditBalance, getCreditPacks, getPlanCreditBalance, TOPUP_CREDIT_EXPIRY_DAYS } from "../_shared/credits.ts";
import type { Tier } from "../_shared/ai/types.ts";
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

type WarningLevel = "ok" | "approaching" | "exceeded";

const VALID_TIERS: ReadonlySet<Tier> = new Set<Tier>(["free", "buyer", "investor"]);

function normalizeTier(raw: unknown): Tier {
  if (typeof raw !== "string") return "free";
  if (VALID_TIERS.has(raw as Tier)) return raw as Tier;
  // Legacy backfill: pre-rename values map to current tiers.
  if (raw === "paid") return "buyer";
  if (raw === "premium") return "investor";
  return "free";
}

function levelFor(usedUsd: number, capUsd: number): WarningLevel {
  if (capUsd <= 0) return "ok";
  const pct = usedUsd / capUsd;
  if (pct >= 1) return "exceeded";
  if (pct >= 0.75) return "approaching";
  return "ok";
}

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  const cors = buildCorsHeaders(req);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth client (validates the user) + service client (reads usage rows
    // regardless of RLS so today's spend is always accurate).
    const authClient = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const svc = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_auth" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const { data: profile } = await svc
      .from("profiles")
      .select("subscription_status, current_period_end, trial_used_at, is_staff")
      .eq("id", user.id)
      .maybeSingle();

    const tier = normalizeTier(profile?.subscription_status);
    const isStaff = Boolean((profile as { is_staff?: boolean } | null)?.is_staff);
    const limits = getBudgetLimits();
    const monthlyLimits = getMonthlyBudgetLimits();
    const capUsd = limits[tier];
    const monthlyCap = monthlyLimits[tier];
    const today = new Date().toISOString().slice(0, 10);

    const { data: rows } = await svc
      .from("ai_usage_log")
      .select("cost_usd")
      .eq("user_id", user.id)
      .eq("usage_date", today);

    let usedUsd = 0;
    for (const r of (rows ?? []) as Array<{ cost_usd: number | string | null }>) {
      const v = typeof r.cost_usd === "string" ? Number(r.cost_usd) : r.cost_usd;
      if (typeof v === "number" && Number.isFinite(v)) usedUsd += v;
    }

    const monthlyUsedUsd = await getMonthSpendUsd(user.id, svc);

    const usagePct = capUsd > 0 ? Math.min(1, usedUsd / capUsd) : 0;
    const monthlyPct = monthlyCap > 0 ? Math.min(1, monthlyUsedUsd / monthlyCap) : 0;
    // Worst-of for the warning chip; cap_type below tells the UI which.
    const dailyLevel = levelFor(usedUsd, capUsd);
    const monthlyLevel = levelFor(monthlyUsedUsd, monthlyCap);
    const rank = { ok: 0, approaching: 1, exceeded: 2 } as const;
    const warningLevel: WarningLevel =
      rank[monthlyLevel] > rank[dailyLevel] ? monthlyLevel : dailyLevel;
    const capType: "daily" | "monthly" | null =
      warningLevel === "exceeded"
        ? (monthlyLevel === "exceeded" ? "monthly" : "daily")
        : null;

    // Credits balance + top-up pack catalog. Free users never see packs.
    const balance = await getActiveCreditBalance(user.id, svc);
    const planCredits = await getPlanCreditBalance(user.id, svc);
    const isPaid = tier === "buyer" || tier === "investor";
    const topup = isPaid
      ? {
          available: true,
          packs: getCreditPacks().map((p) => ({
            size: p.size,
            price_usd: p.priceUsd,
            credit_usd: p.creditUsd,
            bonus_pct: Math.round(((p.creditUsd - p.priceUsd) / p.priceUsd) * 100),
          })),
        }
      : { available: false, packs: [] as Array<never> };

    return new Response(
      JSON.stringify({
        tier,
        is_staff: isStaff,
        usage_today_usd: Number(usedUsd.toFixed(4)),
        daily_limit_usd: capUsd,
        usage_pct: Number(usagePct.toFixed(4)),
        usage_month_usd: Number(monthlyUsedUsd.toFixed(4)),
        monthly_limit_usd: monthlyCap,
        monthly_usage_pct: Number(monthlyPct.toFixed(4)),
        reset_at: nextUtcMidnightIso(),
        monthly_reset_at: firstOfNextMonthIso(),
        warning_level: warningLevel,
        cap_type: capType,
        credits_balance_usd: Number((balance.balanceUsd + planCredits.remainingUsd).toFixed(4)),
        credits_next_expires_at: balance.nextExpiresAt,
        plan_credits_remaining_usd: planCredits.remainingUsd,
        plan_credits_allowance_usd: planCredits.allowanceUsd,
        topup_balance_usd: balance.balanceUsd,
        topup_expiry_days: TOPUP_CREDIT_EXPIRY_DAYS,
        billing_period_end: profile?.current_period_end ?? null,
        trial_used: !!profile?.trial_used_at,
        topup,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[budget-status] error:", (e as Error)?.message);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
})(req)));