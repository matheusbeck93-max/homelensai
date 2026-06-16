/**
 * get_national_housing_index — Case-Shiller National HPI latest value
 * with YoY change and recent trajectory.
 */

import { FRED_SERIES } from '../../../fred-series.ts';
import { getSeriesSafe, yoyPct } from './fredHelper.ts';

export const GET_NATIONAL_HOUSING_INDEX_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_national_housing_index',
    description:
      'Returns the latest US Case-Shiller National Home Price Index value with year-over-year change percent. Sourced from FRED. Prefer this over web search whenever the user asks about national home price trends, US housing prices overall, or how the housing market is performing nationally. Monthly release.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

export async function runGetNationalHousingIndex() {
  const r = await getSeriesSafe(FRED_SERIES.CASE_SHILLER_NATL, 24);
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    case_shiller_national: r.payload.latest?.value ?? null,
    yoy_pct: yoyPct(r.payload),
    as_of: r.payload.latest?.date ?? null,
    source: 'FRED · CSUSHPISA (Case-Shiller National HPI)',
  };
}