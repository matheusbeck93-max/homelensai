/**
 * get_building_permits — most-recent national housing-starts and
 * building-permits authorized counts from FRED. Used as a proxy for
 * "is supply expanding?" until we wire per-metro Census BPS in PR 4.
 */

import { FRED_SERIES } from '../../../fred-series.ts';
import { getSeriesSafe } from './fredHelper.ts';

export const GET_BUILDING_PERMITS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_building_permits',
    description:
      'Returns current US housing-starts and building-permits authorized counts (national, monthly) with year-over-year change percent, sourced from FRED. Use this when the user asks about new construction activity, supply pipeline, or whether builders are pulling back nationally. Metro-level permit data is roadmapped.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

export async function runGetBuildingPermits() {
  const [starts, permits] = await Promise.all([
    getSeriesSafe(FRED_SERIES.HOUSING_STARTS, 24),
    getSeriesSafe(FRED_SERIES.BUILDING_PERMITS, 24),
  ]);
  return {
    ok: true,
    housing_starts_thousands: starts.ok ? starts.payload.latest?.value ?? null : null,
    housing_starts_yoy_pct:
      starts.ok && starts.payload.change_yoy ? starts.payload.change_yoy.percent ?? null : null,
    housing_starts_as_of: starts.ok ? starts.payload.latest?.date ?? null : null,
    building_permits_thousands: permits.ok ? permits.payload.latest?.value ?? null : null,
    building_permits_yoy_pct:
      permits.ok && permits.payload.change_yoy ? permits.payload.change_yoy.percent ?? null : null,
    building_permits_as_of: permits.ok ? permits.payload.latest?.date ?? null : null,
    source: 'FRED · HOUST / PERMIT',
  };
}