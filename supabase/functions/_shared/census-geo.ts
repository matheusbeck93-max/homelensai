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

/**
 * City/metro alias map → canonical "City, ST" string. Covers common
 * regional shorthand the Census Geocoder doesn't understand and
 * frequently-asked metros where city-only queries are ambiguous.
 */
export const CITY_ALIASES: Record<string, string> = {
  nyc: 'New York, NY',
  'new york city': 'New York, NY',
  'new york': 'New York, NY',
  manhattan: 'New York, NY',
  brooklyn: 'Brooklyn, NY',
  queens: 'Queens, NY',
  bronx: 'Bronx, NY',
  la: 'Los Angeles, CA',
  'los angeles': 'Los Angeles, CA',
  hollywood: 'Los Angeles, CA',
  sf: 'San Francisco, CA',
  'san francisco': 'San Francisco, CA',
  'silicon valley': 'San Jose, CA',
  'south bay': 'San Jose, CA',
  'bay area': 'San Francisco, CA',
  dfw: 'Dallas, TX',
  dallas: 'Dallas, TX',
  'fort worth': 'Fort Worth, TX',
  houston: 'Houston, TX',
  austin: 'Austin, TX',
  'san antonio': 'San Antonio, TX',
  dmv: 'Washington, DC',
  'the dmv': 'Washington, DC',
  dc: 'Washington, DC',
  washington: 'Washington, DC',
  'washington dc': 'Washington, DC',
  arlington: 'Arlington, VA',
  alexandria: 'Alexandria, VA',
  bethesda: 'Bethesda, MD',
  miami: 'Miami, FL',
  tampa: 'Tampa, FL',
  orlando: 'Orlando, FL',
  jacksonville: 'Jacksonville, FL',
  chicago: 'Chicago, IL',
  'chi-town': 'Chicago, IL',
  atlanta: 'Atlanta, GA',
  atl: 'Atlanta, GA',
  boston: 'Boston, MA',
  philly: 'Philadelphia, PA',
  philadelphia: 'Philadelphia, PA',
  phoenix: 'Phoenix, AZ',
  seattle: 'Seattle, WA',
  portland: 'Portland, OR',
  denver: 'Denver, CO',
  charlotte: 'Charlotte, NC',
  raleigh: 'Raleigh, NC',
  durham: 'Durham, NC',
  nashville: 'Nashville, TN',
  memphis: 'Memphis, TN',
  detroit: 'Detroit, MI',
  minneapolis: 'Minneapolis, MN',
  'st paul': 'Saint Paul, MN',
  'saint paul': 'Saint Paul, MN',
  'salt lake': 'Salt Lake City, UT',
  'salt lake city': 'Salt Lake City, UT',
  vegas: 'Las Vegas, NV',
  'las vegas': 'Las Vegas, NV',
  pittsburgh: 'Pittsburgh, PA',
  cleveland: 'Cleveland, OH',
  columbus: 'Columbus, OH',
  cincinnati: 'Cincinnati, OH',
  'kansas city': 'Kansas City, MO',
  'st louis': 'Saint Louis, MO',
  'saint louis': 'Saint Louis, MO',
  baltimore: 'Baltimore, MD',
  'san diego': 'San diego, CA',
  'long beach': 'Long Beach, CA',
  oakland: 'Oakland, CA',
  sacramento: 'Sacramento, CA',
  'san jose': 'San Jose, CA',
  fresno: 'Fresno, CA',
  honolulu: 'Honolulu, HI',
  anchorage: 'Anchorage, AK',
  boise: 'Boise, ID',
  albuquerque: 'Albuquerque, NM',
  tucson: 'Tucson, AZ',
  'oklahoma city': 'Oklahoma City, OK',
  okc: 'Oklahoma City, OK',
  tulsa: 'Tulsa, OK',
  milwaukee: 'Milwaukee, WI',
  madison: 'Madison, WI',
  indianapolis: 'Indianapolis, IN',
  louisville: 'Louisville, KY',
  birmingham: 'Birmingham, AL',
  'new orleans': 'New Orleans, LA',
  nola: 'New Orleans, LA',
  richmond: 'Richmond, VA',
  'virginia beach': 'Virginia Beach, VA',
  norfolk: 'Norfolk, VA',
  'research triangle': 'Raleigh, NC',
  triangle: 'Raleigh, NC',
};

/**
 * Top-50 CBSA codes for Census BPS (Building Permits Survey) per-metro
 * queries. Keyed by normalized city name; value is the 5-digit CBSA code.
 */
export const CBSA_CODES: Record<string, { cbsa: string; name: string }> = {
  'new york': { cbsa: '35620', name: 'New York-Newark-Jersey City, NY-NJ-PA' },
  'los angeles': { cbsa: '31080', name: 'Los Angeles-Long Beach-Anaheim, CA' },
  chicago: { cbsa: '16980', name: 'Chicago-Naperville-Elgin, IL-IN-WI' },
  dallas: { cbsa: '19100', name: 'Dallas-Fort Worth-Arlington, TX' },
  houston: { cbsa: '26420', name: 'Houston-The Woodlands-Sugar Land, TX' },
  washington: { cbsa: '47900', name: 'Washington-Arlington-Alexandria, DC-VA-MD-WV' },
  miami: { cbsa: '33100', name: 'Miami-Fort Lauderdale-Pompano Beach, FL' },
  philadelphia: { cbsa: '37980', name: 'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD' },
  atlanta: { cbsa: '12060', name: 'Atlanta-Sandy Springs-Alpharetta, GA' },
  phoenix: { cbsa: '38060', name: 'Phoenix-Mesa-Chandler, AZ' },
  boston: { cbsa: '14460', name: 'Boston-Cambridge-Newton, MA-NH' },
  'san francisco': { cbsa: '41860', name: 'San Francisco-Oakland-Berkeley, CA' },
  riverside: { cbsa: '40140', name: 'Riverside-San Bernardino-Ontario, CA' },
  detroit: { cbsa: '19820', name: 'Detroit-Warren-Dearborn, MI' },
  seattle: { cbsa: '42660', name: 'Seattle-Tacoma-Bellevue, WA' },
  minneapolis: { cbsa: '33460', name: 'Minneapolis-St. Paul-Bloomington, MN-WI' },
  'san diego': { cbsa: '41740', name: 'San Diego-Chula Vista-Carlsbad, CA' },
  tampa: { cbsa: '45300', name: 'Tampa-St. Petersburg-Clearwater, FL' },
  denver: { cbsa: '19740', name: 'Denver-Aurora-Lakewood, CO' },
  'st louis': { cbsa: '41180', name: 'St. Louis, MO-IL' },
  baltimore: { cbsa: '12580', name: 'Baltimore-Columbia-Towson, MD' },
  charlotte: { cbsa: '16740', name: 'Charlotte-Concord-Gastonia, NC-SC' },
  orlando: { cbsa: '36740', name: 'Orlando-Kissimmee-Sanford, FL' },
  'san antonio': { cbsa: '41700', name: 'San Antonio-New Braunfels, TX' },
  portland: { cbsa: '38900', name: 'Portland-Vancouver-Hillsboro, OR-WA' },
  pittsburgh: { cbsa: '38300', name: 'Pittsburgh, PA' },
  sacramento: { cbsa: '40900', name: 'Sacramento-Roseville-Folsom, CA' },
  'las vegas': { cbsa: '29820', name: 'Las Vegas-Henderson-Paradise, NV' },
  cincinnati: { cbsa: '17140', name: 'Cincinnati, OH-KY-IN' },
  'kansas city': { cbsa: '28140', name: 'Kansas City, MO-KS' },
  austin: { cbsa: '12420', name: 'Austin-Round Rock-Georgetown, TX' },
  columbus: { cbsa: '18140', name: 'Columbus, OH' },
  cleveland: { cbsa: '17460', name: 'Cleveland-Elyria, OH' },
  indianapolis: { cbsa: '26900', name: 'Indianapolis-Carmel-Anderson, IN' },
  'san jose': { cbsa: '41940', name: 'San Jose-Sunnyvale-Santa Clara, CA' },
  nashville: { cbsa: '34980', name: 'Nashville-Davidson--Murfreesboro--Franklin, TN' },
  'virginia beach': { cbsa: '47260', name: 'Virginia Beach-Norfolk-Newport News, VA-NC' },
  providence: { cbsa: '39300', name: 'Providence-Warwick, RI-MA' },
  milwaukee: { cbsa: '33340', name: 'Milwaukee-Waukesha, WI' },
  jacksonville: { cbsa: '27260', name: 'Jacksonville, FL' },
  'oklahoma city': { cbsa: '36420', name: 'Oklahoma City, OK' },
  raleigh: { cbsa: '39580', name: 'Raleigh-Cary, NC' },
  memphis: { cbsa: '32820', name: 'Memphis, TN-MS-AR' },
  richmond: { cbsa: '40060', name: 'Richmond, VA' },
  'new orleans': { cbsa: '35380', name: 'New Orleans-Metairie, LA' },
  louisville: { cbsa: '31140', name: 'Louisville/Jefferson County, KY-IN' },
  'salt lake city': { cbsa: '41620', name: 'Salt Lake City, UT' },
  hartford: { cbsa: '25540', name: 'Hartford-East Hartford-Middletown, CT' },
  birmingham: { cbsa: '13820', name: 'Birmingham-Hoover, AL' },
  buffalo: { cbsa: '15380', name: 'Buffalo-Cheektowaga, NY' },
  rochester: { cbsa: '40380', name: 'Rochester, NY' },
};

/**
 * Resolve a free-form metro/city input to a CBSA code, applying the
 * alias map first. Returns null when unknown.
 */
export function resolveCbsa(input: string): { cbsa: string; name: string } | null {
  const raw = (input || '').trim().toLowerCase();
  if (!raw) return null;
  const aliased = CITY_ALIASES[raw];
  const key = (aliased ?? raw).split(',')[0].trim().toLowerCase();
  return CBSA_CODES[key] ?? null;
}

function applyAlias(input: string): string {
  const key = input.trim().toLowerCase();
  return CITY_ALIASES[key] ?? input;
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
  const input = applyAlias((rawInput || '').trim());
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

  // Fallback 1: city-only search via the Census `places` lookup. The
  // geocoder needs a street address for `onelineaddress` matches; for
  // "Austin, TX" alone we hit the ACS subject-table places dataset which
  // accepts NAME + state filtering. This avoids degrading to state-level
  // when the user just typed a city.
  try {
    const cityState = input.split(',').map((s) => s.trim());
    const cityName = cityState[0];
    const stateAbbr = cityState[1]?.toUpperCase();
    if (cityName && stateAbbr && STATE_FIPS[stateAbbr]) {
      const stateFips = STATE_FIPS[stateAbbr];
      // Census places endpoint: returns place FIPS for matching city name.
      const placeUrl = `https://api.census.gov/data/2022/acs/acs5?get=NAME&for=place:*&in=state:${stateFips}`;
      const pRes = await fetch(placeUrl);
      if (pRes.ok) {
        const rows = (await pRes.json()) as string[][];
        // Header row first; rows: [NAME, state, place]
        const target = cityName.toLowerCase();
        const hit = rows.slice(1).find((r) => {
          const name = (r[0] || '').toLowerCase();
          // Census names look like "Austin city, Texas" — match the city stem.
          return (
            name.startsWith(`${target} city,`) ||
            name.startsWith(`${target} town,`) ||
            name.startsWith(`${target} cdp,`) ||
            name.startsWith(`${target},`)
          );
        });
        if (hit) {
          return {
            state_fips: stateFips,
            place_fips: hit[2],
            county_fips: null,
            display_name: hit[0],
            level: 'place',
          };
        }
      }
    }
  } catch (_e) {
    // fall through
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