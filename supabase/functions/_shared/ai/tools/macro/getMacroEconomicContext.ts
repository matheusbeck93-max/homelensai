/**
 * get_macro_economic_context — unemployment, inflation, Fed funds and
 * 10y Treasury in one shot. Used when the user asks about the broader
 * economy, recession risk, or strategic timing.
 */

import { FRED_SERIES } from '../../../fred-series.ts';
import { getSeriesSafe, yoyPct } from './fredHelper.ts';

export const GET_MACRO_ECONOMIC_CONTEXT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_macro_economic_context',
    description:
      'Returns the broader macro snapshot: current US unemployment rate, CPI year-over-year inflation, Fed funds rate, and 10-year Treasury yield. Sourced from FRED. Prefer this over web search when the user asks about the economy overall, recession risk, inflation, or strategic timing decisions.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

export async function runGetMacroEconomicContext() {
  const [ur, cpi, ff, t10] = await Promise.all([
    getSeriesSafe(FRED_SERIES.UNEMPLOYMENT, 24),
    getSeriesSafe(FRED_SERIES.CPI, 24),
    getSeriesSafe(FRED_SERIES.FED_FUNDS_DAILY, 60),
    getSeriesSafe(FRED_SERIES.TREASURY_10Y, 60),
  ]);
  return {
    ok: true,
    unemployment_pct: ur.ok ? ur.payload.latest?.value ?? null : null,
    unemployment_as_of: ur.ok ? ur.payload.latest?.date ?? null : null,
    cpi_yoy_pct: cpi.ok ? yoyPct(cpi.payload) : null,
    cpi_as_of: cpi.ok ? cpi.payload.latest?.date ?? null : null,
    fed_funds_pct: ff.ok ? ff.payload.latest?.value ?? null : null,
    treasury_10y_pct: t10.ok ? t10.payload.latest?.value ?? null : null,
    source: 'FRED · UNRATE / CPIAUCSL / DFF / DGS10',
  };
}