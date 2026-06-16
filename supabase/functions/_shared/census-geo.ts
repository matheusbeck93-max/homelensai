/**
 * Census geography resolver.
 *
 * Maps a free-form US location string ("Austin, TX", "Tampa", "20171")
 * to the FIPS codes the Census ACS API needs:
 *  - state FIPS (2 digits)
 *  - place FIPS (5 digits, for cities)
 *  - metro/CBSA code (5 digits, for MSA-level queries)
 *
 * Uses the public Census Geocoder for ZIP / city lookups and a tiny
 * built-in state name -> FIPS table for state-level fallbacks.
 */

const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17',
  IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46',
  TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56', PR: '72',
};

export interface ResolvedGeo {
  state_fips: string | null;
  place_fips: string | null;
  county_fips: string | null;
  display_name: string;
  level: 'place' | 'county' | 'state' | 'unknown';
}

function stateAbbrFromInput(input: string): string | null {
  const m = input.toUpperCase().match(/\b([A-Z]{2})\b/);
  return m && STATE_FIPS[m[1]] ? m[1] : null;
}

/**
 * Resolve a free-form location to FIPS codes via the Census Geocoder
 * (no key required). Cache-friendly: callers should pass results through
 * the census_cache layer when looping over many locations.
 */
export async function resolveCensusGeo(rawInput: string): Promise<ResolvedGeo> {
  const input = (rawInput || '').trim();
  if (!input) {
    return { state_fips: null, place_fips: null, county_fips: null, display_name: '', level: 'unknown' };
  }

  // ZIP code shortcut: 5-digit ZIP -> Census Geocoder address search.
  const zip = input.match(/^\d{5}$/)?.[0];
  const url = zip
    ? `https://geocoding.geo.census.gov/geocoder/geographies/address?street=&zip=${zip}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`
    : `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(input)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const match = json?.result?.addressMatches?.[0];
      const geo = match?.geographies;
      const place = geo?.['Incorporated Places']?.[0];
      const county = geo?.['Counties']?.[0];
      const state = geo?.['States']?.[0];
      if (place || county || state) {
        return {
          state_fips: state?.STATE ?? place?.STATE ?? county?.STATE ?? null,
          place_fips: place?.PLACE ?? null,
          county_fips: county?.COUNTY ?? null,
          display_name: match?.matchedAddress ?? input,
          level: place ? 'place' : county ? 'county' : 'state',
        };
      }
    }
  } catch (_e) {
    // fall through to state abbreviation lookup
  }

  // Fallback: extract state abbreviation -> state-level FIPS.
  const abbr = stateAbbrFromInput(input);
  if (abbr) {
    return {
      state_fips: STATE_FIPS[abbr],
      place_fips: null,
      county_fips: null,
      display_name: input,
      level: 'state',
    };
  }

  return { state_fips: null, place_fips: null, county_fips: null, display_name: input, level: 'unknown' };
}

export const STATE_FIPS_MAP = STATE_FIPS;