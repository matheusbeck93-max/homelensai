/**
 * get_metro_housing_index — Case-Shiller index for a specific metro
 * (20-city coverage). Falls back to national index with an explicit note
 * for non-covered metros.
 */

import { resolveCaseShillerSeries } from '../../../fred-series.ts';
import { getSeriesSafe, yoyPct } from './fredHelper.ts';

export const GET_METRO_HOUSING_INDEX_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_metro_housing_index',
    description:
      'Returns the Case-Shiller home price index for a specific US metro with year-over-year change. Covered metros (20-city composite): Atlanta, Boston, Charlotte, Chicago, Cleveland, Dallas, Denver, Detroit, Las Vegas, Los Angeles, Miami, Minneapolis, New York, Phoenix, Portland, San Diego, San Francisco, Seattle, Tampa, Washington DC. For other metros, falls back to the national index with a note. Prefer this over web search for metro-level price-trend questions.',
    parameters: {
      type: 'object',
      properties: {
        metro_name: {
          type: 'string',
          description: 'City or metro name (e.g. "Austin", "Tampa", "Los Angeles, CA"). REQUIRED.',
        },
      },
      required: ['metro_name'],
    },
  },
};

export async function runGetMetroHousingIndex(input: { metro_name?: unknown }) {
  const name = typeof input.metro_name === 'string' ? input.metro_name.trim() : '';
  if (!name) return { ok: false, error: 'metro_name required' };
  const { seriesId, metroLabel, fallback } = resolveCaseShillerSeries(name);
  const r = await getSeriesSafe(seriesId, 24);
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    metro: metroLabel,
    case_shiller_index: r.payload.latest?.value ?? null,
    yoy_pct: yoyPct(r.payload),
    as_of: r.payload.latest?.date ?? null,
    fallback_to_national: fallback,
    source: fallback
      ? 'FRED · CSUSHPISA (national fallback — metro not in 20-city coverage)'
      : `FRED · ${seriesId} (Case-Shiller metro)`,
  };
}