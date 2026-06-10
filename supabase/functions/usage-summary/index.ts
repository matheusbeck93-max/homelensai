/**
 * GET /functions/v1/usage-summary
 *
 * Powers the `/account/usage` page. Returns:
 *   - today (live from ai_usage_log)
 *   - this_month rollup + linear projection
 *   - 30-day trend + per-surface breakdown from v_user_usage_daily
 *   - credits balance, next expiry, recent top-up purchases
 *   - next-tier comparison block (null for Investor)
 *
 * Staff users (`profiles.is_staff = true`) get a simplified payload with
 * caps explicitly `null` so the UI can render the "internal account" state.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { handleCors, buildCorsHeaders } from "../_shared/cors.ts";
import {
  getBudgetLimits,
  getMonthlyBudgetLimits,
  nextUtcMidnightIso,
  firstOfNextMonthIso,
} from "../_shared/ai/budgetGuard.ts";
import { getActiveCreditBalance, getPlanCreditBalance, TOPUP_CREDIT_EXPIRY_DAYS } from "../_shared/credits.ts";
import type { Tier } from "../_shared/ai/types.ts";

const TIER_DISPLAY: Record<Tier, string> = {
  free: "Free",
  buyer: "Buyer",
  investor: "Investor",
};

const TIER_PRICE: Record<Tier, number> = {
  free: 0,
  buyer: 9.97,
  investor: 24.97,
};

const NEXT_TIER: Record<Tier, Tier | null> = {
  free: "buyer",
  buyer: "investor",
  investor: null,
};

const NEXT_TIER_FEATURES: Record<Tier, string[]> = {
  free: [
    "Unlimited chat with Match Score",
    "Saved analyses + property alerts",
    "Neighborhood insights & personality",
    "Property comparison + PDF export",
  ],
  buyer: [
    "Investor Calculator — Simple & Advanced",
    "Stress scenarios (Bear/Base/Bull)",
    "20-year IRR projections",
    "Market Comparator",
    "Investor-grade Excel workbooks",
  ],
  investor: [],
};

function normalizeTier(raw: unknown): Tier {
  if (raw === "buyer" || raw === "investor" || raw === "free") return raw;
  if (raw === "paid") return "buyer";
  if (raw === "premium") return "investor";
  return "free";
}

function levelFor(used: number, cap: number): "ok" | "approaching" | "exceeded" {
  if (cap <= 0) return "ok";
  const pct = used / cap;
  if (pct >= 1) return "exceeded";
  if (pct >= 0.75) return "approaching";
  return "ok";
}

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

Deno.serve(async (req) => {
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
    const userId = userData.user.id;

    const { data: profile } = await svc
      .from("profiles")
      .select("subscription_status, current_period_end, is_staff")
      .eq("id", userId)
      .maybeSingle();

    const tier = normalizeTier(profile?.subscription_status);
    const isStaff = Boolean((profile as { is_staff?: boolean } | null)?.is_staff);
    const tierDisplay = TIER_DISPLAY[tier];
    const subscriptionStatus = tier === "free" ? "free" : "active";
    const nextBilling = (profile as { current_period_end?: string | null } | null)?.current_period_end ?? null;

    // ── Live today read ───────────────────────────────────────────────
    const todayKey = new Date().toISOString().slice(0, 10);
    const { data: todayRows } = await svc
      .from("ai_usage_log")
      .select("cost_usd")
      .eq("user_id", userId)
      .eq("usage_date", todayKey);
    let usageTodayUsd = 0;
    for (const r of (todayRows ?? []) as Array<{ cost_usd: number | string | null }>) {
      usageTodayUsd += toNum(r.cost_usd);
    }

    // ── 30-day daily rollup from the materialized view ────────────────
    const monthStartIso = (() => {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10);
    })();
    const thirtyAgoIso = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 29);
      return d.toISOString().slice(0, 10);
    })();

    const { data: rollupRows } = await svc
      .from("v_user_usage_daily")
      .select("day, surface, calls, usage_usd")
      .eq("user_id", userId)
      .gte("day", thirtyAgoIso);

    type Roll = { day: string; surface: string; calls: number | string; usage_usd: number | string };
    const rolls = (rollupRows ?? []) as Roll[];

    // Per-day total for the trend chart (last 30 days, zero-filled)
    const trendMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - (29 - i));
      trendMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of rolls) {
      const day = String(r.day).slice(0, 10);
      if (trendMap.has(day)) {
        trendMap.set(day, (trendMap.get(day) ?? 0) + toNum(r.usage_usd));
      }
    }
    // Patch today's value with live read so it reflects last few minutes.
    trendMap.set(todayKey, usageTodayUsd);
    const monthTrend = Array.from(trendMap.entries()).map(([date, usage_usd]) => ({
      date,
      usage_usd: Number(usage_usd.toFixed(4)),
    }));

    // Per-surface 30-day breakdown
    const surfaceMap = new Map<string, { calls: number; usage_usd: number }>();
    for (const r of rolls) {
      const cur = surfaceMap.get(r.surface) ?? { calls: 0, usage_usd: 0 };
      cur.calls += toNum(r.calls);
      cur.usage_usd += toNum(r.usage_usd);
      surfaceMap.set(r.surface, cur);
    }
    const perSurface30d = Array.from(surfaceMap.entries())
      .map(([surface, v]) => ({
        surface,
        calls: Math.round(v.calls),
        usage_usd: Number(v.usage_usd.toFixed(4)),
      }))
      .sort((a, b) => b.usage_usd - a.usage_usd);

    // ── This month rollup ─────────────────────────────────────────────
    let usageMonthUsd = 0;
    for (const [day, v] of trendMap.entries()) {
      if (day >= monthStartIso) usageMonthUsd += v;
    }

    const dailyLimits = getBudgetLimits();
    const monthlyLimits = getMonthlyBudgetLimits();
    const dailyCap = dailyLimits[tier];
    const monthlyCap = monthlyLimits[tier];

    const now = new Date();
    const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
    const dayOfMonth = now.getUTCDate();
    const daysRemaining = daysInMonth - dayOfMonth;

    const avgPerDay = dayOfMonth > 0 ? usageMonthUsd / dayOfMonth : 0;
    const projectedEndOfMonth = avgPerDay * daysInMonth;
    const projectedToHitCap = projectedEndOfMonth > monthlyCap && monthlyCap > 0;
    let projectedCapHitDate: string | null = null;
    if (projectedToHitCap && avgPerDay > 0) {
      const daysUntilCap = Math.ceil((monthlyCap - usageMonthUsd) / avgPerDay);
      const hit = new Date(now);
      hit.setUTCDate(hit.getUTCDate() + Math.max(1, daysUntilCap));
      projectedCapHitDate = hit.toISOString().slice(0, 10);
    }

    // Remaining turns estimate: $0.020 per turn (Sonnet typical).
    const remainingTurnsEstimate = Math.max(0, Math.floor((dailyCap - usageTodayUsd) / 0.020));

    // ── Credits ───────────────────────────────────────────────────────
    const [topup, plan] = await Promise.all([
      getActiveCreditBalance(userId, svc),
      getPlanCreditBalance(userId, svc),
    ]);
    const totalCredits = topup.balanceUsd + plan.remainingUsd;
    const nextExpiresAt = topup.nextExpiresAt;
    const expiresSoon = (() => {
      if (!nextExpiresAt) return false;
      const ms = new Date(nextExpiresAt).getTime() - Date.now();
      return ms > 0 && ms < 7 * 24 * 60 * 60 * 1000;
    })();

    const { data: purchaseRows } = await svc
      .from("topup_events")
      .select("event_type, price_usd, credit_usd, pack_size, created_at")
      .eq("user_id", userId)
      .eq("event_type", "purchased")
      .order("created_at", { ascending: false })
      .limit(5);
    const recentPurchases = ((purchaseRows ?? []) as Array<{
      pack_size: string | null;
      price_usd: number | string | null;
      credit_usd: number | string | null;
      created_at: string;
    }>).map((p) => ({
      pack_size: p.pack_size,
      amount_usd: toNum(p.credit_usd),
      price_usd: toNum(p.price_usd),
      purchased_at: p.created_at,
    }));

    // ── Staff payload (caps null) ─────────────────────────────────────
    if (isStaff) {
      return new Response(
        JSON.stringify({
          tier,
          is_staff: true,
          tier_display_name: tierDisplay,
          subscription_status: subscriptionStatus,
          next_billing_date: nextBilling,
          today: null,
          this_month: null,
          credits: {
            balance_usd: Number(totalCredits.toFixed(4)),
            expires_at: nextExpiresAt,
            expires_soon: false,
            recent_purchases: recentPurchases,
          },
          per_surface_30d: perSurface30d,
          month_trend: monthTrend,
          next_tier: null,
          topup_expiry_days: TOPUP_CREDIT_EXPIRY_DAYS,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Next tier block ───────────────────────────────────────────────
    const nextTierKey = NEXT_TIER[tier];
    const nextTier = nextTierKey
      ? {
          name: nextTierKey,
          display_name: TIER_DISPLAY[nextTierKey],
          price_usd: TIER_PRICE[nextTierKey],
          daily_limit_usd: dailyLimits[nextTierKey],
          monthly_limit_usd: monthlyLimits[nextTierKey],
          additional_features: NEXT_TIER_FEATURES[tier],
          checkout_url: `/pricing?plan=${nextTierKey}&source=usage_page`,
        }
      : null;

    const todayPct = dailyCap > 0 ? Math.min(1, usageTodayUsd / dailyCap) : 0;
    const monthPct = monthlyCap > 0 ? Math.min(1, usageMonthUsd / monthlyCap) : 0;

    return new Response(
      JSON.stringify({
        tier,
        is_staff: false,
        tier_display_name: tierDisplay,
        subscription_status: subscriptionStatus,
        next_billing_date: nextBilling,
        today: {
          usage_usd: Number(usageTodayUsd.toFixed(4)),
          daily_limit_usd: dailyCap,
          usage_pct: Math.round(todayPct * 100),
          remaining_turns_estimate: remainingTurnsEstimate,
          reset_at: nextUtcMidnightIso(),
          warning_level: levelFor(usageTodayUsd, dailyCap),
        },
        this_month: {
          usage_usd: Number(usageMonthUsd.toFixed(4)),
          monthly_limit_usd: monthlyCap,
          usage_pct: Math.round(monthPct * 100),
          days_remaining: daysRemaining,
          projected_end_of_month_usd: Number(projectedEndOfMonth.toFixed(2)),
          projected_to_hit_cap: projectedToHitCap,
          projected_cap_hit_date: projectedCapHitDate,
          reset_at: firstOfNextMonthIso(),
          warning_level: levelFor(usageMonthUsd, monthlyCap),
        },
        credits: {
          balance_usd: Number(totalCredits.toFixed(4)),
          topup_balance_usd: Number(topup.balanceUsd.toFixed(4)),
          plan_balance_usd: Number(plan.remainingUsd.toFixed(4)),
          expires_at: nextExpiresAt,
          expires_soon: expiresSoon,
          recent_purchases: recentPurchases,
        },
        per_surface_30d: perSurface30d,
        month_trend: monthTrend,
        next_tier: nextTier,
        topup_expiry_days: TOPUP_CREDIT_EXPIRY_DAYS,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[usage-summary] error:", (e as Error)?.message);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});