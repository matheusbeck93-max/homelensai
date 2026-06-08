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
  nextUtcMidnightIso,
} from "../_shared/ai/budgetGuard.ts";
import { getActiveCreditBalance, getCreditPacks } from "../_shared/credits.ts";
import type { Tier } from "../_shared/ai/types.ts";

type WarningLevel = "ok" | "approaching" | "exceeded";

const VALID_TIERS: ReadonlySet<Tier> = new Set<Tier>(["free", "paid", "premium"]);

function normalizeTier(raw: unknown): Tier {
  if (typeof raw !== "string") return "free";
  if (VALID_TIERS.has(raw as Tier)) return raw as Tier;
  // Frontend uses buyer/investor — translate for the budget guard.
  if (raw === "buyer") return "paid";
  if (raw === "investor") return "premium";
  return "free";
}

function levelFor(usedUsd: number, capUsd: number): WarningLevel {
  if (capUsd <= 0) return "ok";
  const pct = usedUsd / capUsd;
  if (pct >= 1) return "exceeded";
  if (pct >= 0.75) return "approaching";
  return "ok";
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
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    const tier = normalizeTier(profile?.subscription_status);
    const limits = getBudgetLimits();
    const capUsd = limits[tier];
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

    const usagePct = capUsd > 0 ? Math.min(1, usedUsd / capUsd) : 0;
    const warningLevel = levelFor(usedUsd, capUsd);

    // Credits balance + top-up pack catalog. Free users never see packs.
    const balance = await getActiveCreditBalance(user.id, svc);
    const isPaid = tier === "paid" || tier === "premium";
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
        usage_today_usd: Number(usedUsd.toFixed(4)),
        daily_limit_usd: capUsd,
        usage_pct: Number(usagePct.toFixed(4)),
        reset_at: nextUtcMidnightIso(),
        warning_level: warningLevel,
        credits_balance_usd: balance.balanceUsd,
        credits_next_expires_at: balance.nextExpiresAt,
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
});