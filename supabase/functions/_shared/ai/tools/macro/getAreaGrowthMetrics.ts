/**
 * get_area_growth_metrics — 5-year population growth for a US area,
 * derived from two ACS vintages (current ACS_YEAR vs 5 years prior).
 */

import { ACS_VARS, getCensusData, CURRENT_ACS_YEAR } from '../../../census-client.ts';
import { resolveCensusGeo } from '../../../census-geo.ts';

const PRIOR_ACS_YEAR = String(Number(CURRENT_ACS_YEAR) - 5);

export const GET_AREA_GROWTH_METRICS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_area_growth_metrics',
    description:
      'Returns 5-year population growth percent for a US city/county/state, computed from Census ACS 5-yr releases. Use this when the user asks "is this area growing", "what\'s the migration trend", or "is the population shrinking".',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'US city/area or ZIP. REQUIRED.' },
      },
      required: ['location'],
    },
  },
};

function clauseFor(geo: Awaited<ReturnType<typeof resolveCensusGeo>>): string | null {
  if (geo.place_fips && geo.state_fips) return `for=place:${geo.place_fips}&in=state:${geo.state_fips}`;
  if (geo.county_fips && geo.state_fips) return `for=county:${geo.county_fips}&in=state:${geo.state_fips}`;
  if (geo.state_fips) return `for=state:${geo.state_fips}`;
  return null;
}

/** Manual two-year fetch (current vs prior) to compute the delta. */
async function fetchAcsYear(
  year: string,
  geo: Awaited<ReturnType<typeof resolveCensusGeo>>,
): Promise<number | null> {
  const clause = clauseFor(geo);
  if (!clause) return null;

  const url = `https://api.census.gov/data/${year}/acs/acs5?get=NAME,${ACS_VARS.POPULATION}&${clause}${
    Deno.env.get('CENSUS_API_KEY') ? `&key=${Deno.env.get('CENSUS_API_KEY')}` : ''
  }`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as string[][];
    const idx = json[0].indexOf(ACS_VARS.POPULATION);
    const v = Number(json[1]?.[idx]);
    return Number.isFinite(v) ? v : null;
  } catch (_e) {
    return null;
  }
}

export async function runGetAreaGrowthMetrics(input: { location?: unknown }) {
  const loc = typeof input.location === 'string' ? input.location.trim() : '';
  if (!loc) return { ok: false, error: 'location required' };

  const geo = await resolveCensusGeo(loc);
  if (geo.level === 'unknown' || !geo.state_fips) {
    return { ok: false, error: `Could not resolve "${loc}".` };
  }

  // Use getCensusData for the current year (caches in census_cache) and a
  // dedicated cache key for the prior year so we still get cache benefits.
  const [curr, prior] = await Promise.all([
    getCensusData({
      cacheKey: `acs_pop_${geo.level}_${geo.state_fips}_${geo.place_fips ?? geo.county_fips ?? 'state'}_${CURRENT_ACS_YEAR}`,
      geography: clauseFor(geo)!,
      variables: [ACS_VARS.POPULATION],
    })
      .then((r) => r.values[ACS_VARS.POPULATION])
      .catch(() => null),
    fetchAcsYear(PRIOR_ACS_YEAR, geo),
  ]);

  if (curr == null || prior == null || !prior) {
    return { ok: false, error: 'Population data unavailable for one or both vintages.' };
  }

  const deltaPct = +(((curr - prior) / prior) * 100).toFixed(2);

  return {
    ok: true,
    location: geo.display_name,
    level: geo.level,
    population_current: curr,
    population_5yr_ago: prior,
    growth_5yr_pct: deltaPct,
    annualized_pct: +((deltaPct / 5).toFixed(2)),
    source: `Census ACS 5-yr (${PRIOR_ACS_YEAR} -> ${CURRENT_ACS_YEAR})`,
    as_of: `${CURRENT_ACS_YEAR}-12-31`,
  };
}