/**
 * get_rate_environment_analysis — the WHY behind current rates. Fed funds,
 * 10y Treasury, mortgage spread, recent direction. Pairs with Perplexity
 * for forward-looking sentiment.
 *
 * Prefer this over web search when the user asks "why are rates moving",
 * "will rates drop", or "what's driving mortgage rates".
 */

import { FRED_SERIES } from '../../../fred-series.ts';
import { getSeriesSafe } from './fredHelper.ts';

export const GET_RATE_ENVIRONMENT_ANALYSIS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_rate_environment_analysis',
    description:
      "Returns the broader rate environment: Fed funds rate, 10-year Treasury yield, and the 30-yr mortgage spread (mortgage rate minus 10y Treasury), with 90-day changes. Sourced from FRED. Prefer this over web search when the user asks why rates are moving, what's driving them, or whether they'll drop. Combine with web search for forward-looking Fed commentary.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

export async function runGetRateEnvironmentAnalysis() {
  const [ff, t10, m30] = await Promise.all([
    getSeriesSafe(FRED_SERIES.FED_FUNDS_DAILY, 180),
    getSeriesSafe(FRED_SERIES.TREASURY_10Y, 180),
    getSeriesSafe(FRED_SERIES.MORTGAGE_30Y, 60),
  ]);
  if (!t10.ok || !m30.ok) {
    return { ok: false, error: 'FRED rate-environment series unavailable' };
  }
  const t10Val = t10.payload.latest?.value ?? null;
  const m30Val = m30.payload.latest?.value ?? null;
  const spreadBps =
    t10Val != null && m30Val != null ? Math.round((m30Val - t10Val) * 100) : null;

  return {
    ok: true,
    fed_funds: ff.ok
      ? {
          current: ff.payload.latest?.value ?? null,
          change_90d_bps: ff.payload.change_90d?.percent_pts ?? null,
          as_of: ff.payload.latest?.date ?? null,
        }
      : null,
    treasury_10y: {
      current: t10Val,
      change_90d_bps: t10.payload.change_90d?.percent_pts ?? null,
      as_of: t10.payload.latest?.date ?? null,
    },
    mortgage_30y: {
      current: m30Val,
      change_90d_bps: m30.payload.change_90d?.percent_pts ?? null,
      as_of: m30.payload.latest?.date ?? null,
    },
    mortgage_spread_bps: spreadBps,
    source: 'FRED · DFF / DGS10 / MORTGAGE30US',
  };
}