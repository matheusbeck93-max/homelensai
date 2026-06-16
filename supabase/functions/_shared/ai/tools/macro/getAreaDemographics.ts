/**
 * get_area_demographics — ACS 5-yr demographics for a US city or area.
 * Returns population, median income, median age, ownership rate,
 * education attainment, median home value, and median gross rent.
 */

import { ACS_VARS, getCensusData, CURRENT_ACS_YEAR } from '../../../census-client.ts';
import { resolveCensusGeo } from '../../../census-geo.ts';

export const GET_AREA_DEMOGRAPHICS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_area_demographics',
    description:
      'Returns Census ACS 5-year demographics for a US city, county, or state: population, median household income, median age, homeownership rate, median home value, median gross rent, and education attainment (% with bachelor\'s degree or higher). Prefer this over web search for any "who lives here" or "what\'s the demographic profile" question. Annual release.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'US city/area, e.g. "Austin, TX", "Tampa", or a ZIP code. REQUIRED.',
        },
      },
      required: ['location'],
    },
  },
};

function buildGeographyClause(geo: Awaited<ReturnType<typeof resolveCensusGeo>>): string | null {
  if (geo.place_fips && geo.state_fips) {
    return `for=place:${geo.place_fips}&in=state:${geo.state_fips}`;
  }
  if (geo.county_fips && geo.state_fips) {
    return `for=county:${geo.county_fips}&in=state:${geo.state_fips}`;
  }
  if (geo.state_fips) {
    return `for=state:${geo.state_fips}`;
  }
  return null;
}

export async function runGetAreaDemographics(input: { location?: unknown }) {
  const loc = typeof input.location === 'string' ? input.location.trim() : '';
  if (!loc) return { ok: false, error: 'location required' };

  const geo = await resolveCensusGeo(loc);
  const clause = buildGeographyClause(geo);
  if (!clause) {
    return { ok: false, error: `Could not resolve "${loc}" to a Census geography.` };
  }

  const variables = [
    ACS_VARS.POPULATION,
    ACS_VARS.MEDIAN_HOUSEHOLD_INCOME,
    ACS_VARS.MEDIAN_AGE,
    ACS_VARS.OWNER_OCCUPIED,
    ACS_VARS.TOTAL_OCCUPIED,
    ACS_VARS.MEDIAN_HOME_VALUE,
    ACS_VARS.MEDIAN_GROSS_RENT,
    ACS_VARS.BACHELORS_OR_HIGHER,
    ACS_VARS.POP_25_PLUS,
  ];

  try {
    const r = await getCensusData({
      cacheKey: `acs_demo_${geo.level}_${geo.state_fips}_${geo.place_fips ?? geo.county_fips ?? 'state'}_${CURRENT_ACS_YEAR}`,
      geography: clause,
      variables,
    });
    const owner = r.values[ACS_VARS.OWNER_OCCUPIED];
    const total = r.values[ACS_VARS.TOTAL_OCCUPIED];
    const ownershipPct = owner != null && total ? +((owner / total) * 100).toFixed(1) : null;
    const bach = r.values[ACS_VARS.BACHELORS_OR_HIGHER];
    const pop25 = r.values[ACS_VARS.POP_25_PLUS];
    const bachPct = bach != null && pop25 ? +((bach / pop25) * 100).toFixed(1) : null;

    return {
      ok: true,
      location: geo.display_name,
      level: geo.level,
      population: r.values[ACS_VARS.POPULATION],
      median_household_income_usd: r.values[ACS_VARS.MEDIAN_HOUSEHOLD_INCOME],
      median_age: r.values[ACS_VARS.MEDIAN_AGE],
      homeownership_pct: ownershipPct,
      median_home_value_usd: r.values[ACS_VARS.MEDIAN_HOME_VALUE],
      median_gross_rent_usd: r.values[ACS_VARS.MEDIAN_GROSS_RENT],
      pct_bachelors_or_higher: bachPct,
      source: `Census ACS 5-yr (${CURRENT_ACS_YEAR})`,
      as_of: `${CURRENT_ACS_YEAR}-12-31`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}