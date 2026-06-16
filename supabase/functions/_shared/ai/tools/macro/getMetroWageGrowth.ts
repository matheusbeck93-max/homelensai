/**
 * get_metro_wage_growth — BLS OEWS year-over-year change in median
 * annual wage for a US metro, compared against the local Case-Shiller
 * home price index YoY (FRED). Answers "are wages keeping up with home
 * prices here?".
 */

import { getBlsSeries, blsOews, resolveMsa } from '../../../bls-client.ts';
import { resolveCaseShillerSeries } from '../../../fred-series.ts';
import { getSeriesSafe, yoyPct } from './fredHelper.ts';

export const GET_METRO_WAGE_GROWTH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_metro_wage_growth',
    description:
      'Returns year-over-year change in median annual wage for a US metro (BLS OEWS) compared against local home-price YoY (FRED Case-Shiller). Use this for "are wages keeping up with home prices in [metro]?" questions. Covered metros: top 20 by population. Returns ok:false for other metros.',
    parameters: {
      type: 'object',
      properties: {
        metro_name: { type: 'string', description: 'Metro name, e.g. "Austin" or "Tampa, FL". REQUIRED.' },
      },
      required: ['metro_name'],
    },
  },
};

export async function runGetMetroWageGrowth(input: { metro_name?: unknown }) {
  const name = typeof input.metro_name === 'string' ? input.metro_name.trim() : '';
  if (!name) return { ok: false, error: 'metro_name required' };
  const msa = resolveMsa(name);
  if (!msa) {
    return { ok: false, error: `BLS OEWS coverage limited to top 20 US metros — "${name}" not in map.` };
  }

  try {
    const seriesId = blsOews.medianAnnualWageAllOcc(msa.code);
    // OEWS is annual — pull current + prior year.
    const now = new Date();
    const wages = await getBlsSeries({
      cacheKey: `bls_oews_wage_yoy_${msa.code}`,
      seriesIds: [seriesId],
      startYear: now.getFullYear() - 3,
      endYear: now.getFullYear(),
      ttlMinutes: 60 * 24 * 30,
    });
    const obs = wages[seriesId]?.observations ?? [];
    const valid = obs.filter((o) => o.value != null);
    const latest = valid[valid.length - 1] ?? null;
    const prior = valid.length >= 2 ? valid[valid.length - 2] : null;
    const currentWage = latest?.value ?? null;
    const priorWage = prior?.value ?? null;
    const wageYoyPct =
      currentWage != null && priorWage != null && priorWage > 0
        ? +(((currentWage - priorWage) / priorWage) * 100).toFixed(1)
        : null;

    // Local home-price YoY via Case-Shiller metro index.
    const cs = resolveCaseShillerSeries(name);
    const csRes = await getSeriesSafe(cs.seriesId, 24);
    const priceYoy = csRes.ok ? yoyPct(csRes.payload) : null;

    const gap =
      wageYoyPct != null && priceYoy != null ? +(wageYoyPct - priceYoy).toFixed(1) : null;

    return {
      ok: true,
      metro: msa.name,
      current_median_wage_usd: currentWage,
      wage_yoy_pct: wageYoyPct,
      home_price_yoy_pct: priceYoy,
      wage_vs_price_gap_pp: gap,
      verdict:
        gap == null
          ? null
          : gap >= 0.5
            ? 'Wages outpacing home prices.'
            : gap <= -2
              ? 'Wages falling well behind home prices — affordability deteriorating.'
              : 'Wages roughly tracking home prices.',
      period: latest ? `${latest.year}` : null,
      sources: cs.fallback
        ? 'BLS OEWS (wages) + FRED Case-Shiller national (no metro index)'
        : `BLS OEWS (wages) + FRED Case-Shiller ${cs.seriesId}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}