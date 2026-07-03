/**
 * extension-macro-badge edge function
 *
 * Thin aggregator used by the Chrome extension popup to render a single
 * "macro snapshot" card for the detected listing's metro. Wraps four
 * existing shared macro tools so the extension makes ONE network call
 * (with shared edge caching downstream) instead of four.
 *
 * Auth: requires a Supabase JWT (same pattern as extension-followups).
 * Body: { city: string, state: string }  — state is the 2-letter code.
 *
 * Returns:
 *   {
 *     ok: true,
 *     metro: string,
 *     labor: { unemployment_pct, labor_force, as_of } | null,
 *     wage:  { wage_yoy_pct, home_price_yoy_pct, wage_vs_price_gap_pp, verdict } | null,
 *     hpi:   { case_shiller_index, yoy_pct, as_of, fallback_to_national } | null,
 *     rate:  { rate_30y_pct, change_30d_bps, as_of } | null,
 *     generated_at: string,
 *     source: 'BLS + FRED',
 *   }
 *
 * Individual blocks are null when the metro is outside coverage (e.g.
 * BLS LAUS top-20 only). The card hides any null row client-side.
 */

import { z } from 'https://esm.sh/zod@3.23.8';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { runGetMetroLaborMarket } from '../_shared/ai/tools/macro/getMetroLaborMarket.ts';
import { runGetMetroWageGrowth } from '../_shared/ai/tools/macro/getMetroWageGrowth.ts';
import { runGetMetroHousingIndex } from '../_shared/ai/tools/macro/getMetroHousingIndex.ts';
import { runGetCurrentMortgageRates } from '../_shared/ai/tools/macro/getCurrentMortgageRates.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const BodySchema = z.object({
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(2).max(40),
});

function pick<T extends object, K extends string>(o: unknown, key: K): unknown {
  return o && typeof o === 'object' && key in (o as Record<string, unknown>)
    ? (o as Record<string, unknown>)[key]
    : undefined;
}
function isOk(o: unknown): o is { ok: true } & Record<string, unknown> {
  return !!o && typeof o === 'object' && (o as { ok?: boolean }).ok === true;
}

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const { city, state } = parsed.data;
    const metroQuery = `${city}, ${state}`;

    const [labor, wage, hpi, rate] = await Promise.all([
      runGetMetroLaborMarket({ metro_name: metroQuery }).catch(() => null),
      runGetMetroWageGrowth({ metro_name: metroQuery }).catch(() => null),
      runGetMetroHousingIndex({ metro_name: metroQuery }).catch(() => null),
      runGetCurrentMortgageRates().catch(() => null),
    ]);

    const laborBlock = isOk(labor)
      ? {
          unemployment_pct: pick(labor, 'unemployment_pct') as number | null,
          labor_force: pick(labor, 'labor_force') as number | null,
          as_of: pick(labor, 'as_of') as string | null,
        }
      : null;

    const wageBlock = isOk(wage)
      ? {
          wage_yoy_pct: pick(wage, 'wage_yoy_pct') as number | null,
          home_price_yoy_pct: pick(wage, 'home_price_yoy_pct') as number | null,
          wage_vs_price_gap_pp: pick(wage, 'wage_vs_price_gap_pp') as number | null,
          verdict: pick(wage, 'verdict') as string | null,
        }
      : null;

    const hpiBlock = isOk(hpi)
      ? {
          case_shiller_index: pick(hpi, 'case_shiller_index') as number | null,
          yoy_pct: pick(hpi, 'yoy_pct') as number | null,
          as_of: pick(hpi, 'as_of') as string | null,
          fallback_to_national: !!pick(hpi, 'fallback_to_national'),
        }
      : null;

    const rateInner = isOk(rate) ? (pick(rate, 'rates') as Record<string, unknown> | null) : null;
    const r30 = rateInner ? (rateInner['30y_fixed'] as Record<string, unknown> | null) : null;
    const rateBlock = r30
      ? {
          rate_30y_pct: (r30.current as number | null) ?? null,
          change_30d_bps: (r30.change_30d_bps as number | null) ?? null,
          as_of: (r30.as_of as string | null) ?? null,
        }
      : null;

    // Coverage telemetry — matches investor-brief pattern.
    if (!laborBlock || !wageBlock) {
      console.warn(
        JSON.stringify({
          event: 'extension_macro_badge.bls_coverage_gap',
          metro: metroQuery,
          labor_present: !!laborBlock,
          wage_present: !!wageBlock,
        }),
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        metro: (isOk(labor) && (pick(labor, 'metro') as string)) ||
          (isOk(wage) && (pick(wage, 'metro') as string)) ||
          (isOk(hpi) && (pick(hpi, 'metro') as string)) ||
          metroQuery,
        labor: laborBlock,
        wage: wageBlock,
        hpi: hpiBlock,
        rate: rateBlock,
        generated_at: new Date().toISOString(),
        source: 'BLS + FRED',
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          // Edge cache hint: macro data is daily-fresh.
          'Cache-Control': 'public, max-age=1800',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})(req)));