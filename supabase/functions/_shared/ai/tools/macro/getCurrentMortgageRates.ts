/**
 * get_current_mortgage_rates — today's 30y + 15y fixed rates with trend
 * context (30d, 90d, YoY in basis points). FRED-sourced, cache-first.
 *
 * Prefer this tool over Perplexity whenever the user asks about CURRENT
 * mortgage rates, refi timing, payment estimation, or rate trajectory —
 * the cached FRED value is canonical and faster than a search call.
 */

import { FRED_SERIES } from '../../../fred-series.ts';
import { getSeriesSafe } from './fredHelper.ts';

export const GET_CURRENT_MORTGAGE_RATES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_current_mortgage_rates',
    description:
      "Returns today's US 30-yr and 15-yr fixed mortgage rates with 30-day, 90-day, and year-over-year changes in basis points, sourced from FRED. Prefer this over web search whenever the user asks about current mortgage rates, monthly payment estimation, refi timing, or 'are rates going up/down?'. Updates weekly (Thursdays). Returns numbers and dates — no parameters needed.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

export async function runGetCurrentMortgageRates() {
  const [r30, r15] = await Promise.all([
    getSeriesSafe(FRED_SERIES.MORTGAGE_30Y, 60),
    getSeriesSafe(FRED_SERIES.MORTGAGE_15Y, 60),
  ]);
  if (!r30.ok) return { ok: false, error: r30.error };
  const p30 = r30.payload;
  const p15 = r15.ok ? r15.payload : null;
  return {
    ok: true,
    rates: {
      '30y_fixed': {
        current: p30.latest?.value ?? null,
        change_30d_bps: p30.change_30d?.percent_pts ?? null,
        change_90d_bps: p30.change_90d?.percent_pts ?? null,
        change_yoy_bps: p30.change_yoy?.percent_pts ?? null,
        as_of: p30.latest?.date ?? null,
      },
      '15y_fixed': p15
        ? {
            current: p15.latest?.value ?? null,
            change_30d_bps: p15.change_30d?.percent_pts ?? null,
            as_of: p15.latest?.date ?? null,
          }
        : null,
    },
    source: 'FRED · MORTGAGE30US / MORTGAGE15US',
  };
}