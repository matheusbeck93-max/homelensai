// US states with major cities relevant for real estate market comparison.
// Curated list of the most populous / investment-relevant cities per state.

export interface UsState {
  code: string;
  name: string;
  cities: string[];
}

export const US_STATES: UsState[] = [
  { code: "AL", name: "Alabama", cities: ["Birmingham", "Huntsville", "Montgomery", "Mobile", "Tuscaloosa", "Auburn"] },
  { code: "AK", name: "Alaska", cities: ["Anchorage", "Fairbanks", "Juneau", "Wasilla"] },
  { code: "AZ", name: "Arizona", cities: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Gilbert", "Glendale", "Tempe", "Peoria", "Surprise", "Flagstaff"] },
  { code: "AR", name: "Arkansas", cities: ["Little Rock", "Fayetteville", "Bentonville", "Fort Smith", "Springdale", "Rogers", "Conway"] },
  { code: "CA", name: "California", cities: ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno", "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Anaheim", "Santa Ana", "Riverside", "Stockton", "Irvine", "Chula Vista", "Fremont", "San Bernardino", "Modesto", "Oxnard", "Fontana", "Santa Clarita", "Glendale", "Huntington Beach", "Garden Grove", "Santa Rosa", "Palm Springs"] },
  { code: "CO", name: "Colorado", cities: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood", "Thornton", "Arvada", "Westminster", "Pueblo", "Boulder", "Greeley"] },
  { code: "CT", name: "Connecticut", cities: ["Bridgeport", "New Haven", "Stamford", "Hartford", "Waterbury", "Norwalk", "Danbury"] },
  { code: "DE", name: "Delaware", cities: ["Wilmington", "Dover", "Newark", "Middletown"] },
  { code: "FL", name: "Florida", cities: ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Hialeah", "Port St. Lucie", "Tallahassee", "Cape Coral", "Fort Lauderdale", "Pembroke Pines", "Hollywood", "Gainesville", "Miramar", "Coral Springs", "Clearwater", "Palm Bay", "West Palm Beach", "Lakeland", "Pompano Beach", "Naples", "Sarasota", "Fort Myers"] },
  { code: "GA", name: "Georgia", cities: ["Atlanta", "Augusta", "Columbus", "Macon", "Savannah", "Athens", "Sandy Springs", "Roswell", "Johns Creek", "Albany", "Marietta", "Alpharetta"] },
  { code: "HI", name: "Hawaii", cities: ["Honolulu", "Hilo", "Kailua", "Kapolei", "Pearl City"] },
  { code: "ID", name: "Idaho", cities: ["Boise", "Meridian", "Nampa", "Idaho Falls", "Pocatello", "Caldwell", "Coeur d'Alene"] },
  { code: "IL", name: "Illinois", cities: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford", "Springfield", "Elgin", "Peoria", "Champaign", "Waukegan", "Evanston"] },
  { code: "IN", name: "Indiana", cities: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel", "Fishers", "Bloomington", "Hammond", "Gary", "Lafayette"] },
  { code: "IA", name: "Iowa", cities: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City", "Waterloo", "Ames"] },
  { code: "KS", name: "Kansas", cities: ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka", "Lawrence", "Manhattan"] },
  { code: "KY", name: "Kentucky", cities: ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington", "Frankfort"] },
  { code: "LA", name: "Louisiana", cities: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles", "Metairie"] },
  { code: "ME", name: "Maine", cities: ["Portland", "Lewiston", "Bangor", "South Portland", "Augusta"] },
  { code: "MD", name: "Maryland", cities: ["Baltimore", "Frederick", "Rockville", "Gaithersburg", "Bowie", "Hagerstown", "Annapolis", "Silver Spring", "Bethesda"] },
  { code: "MA", name: "Massachusetts", cities: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Brockton", "Quincy", "Lynn", "New Bedford", "Newton", "Somerville"] },
  { code: "MI", name: "Michigan", cities: ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor", "Lansing", "Flint", "Dearborn", "Livonia", "Troy", "Kalamazoo"] },
  { code: "MN", name: "Minnesota", cities: ["Minneapolis", "Saint Paul", "Rochester", "Duluth", "Bloomington", "Brooklyn Park", "Plymouth", "Woodbury", "Maple Grove"] },
  { code: "MS", name: "Mississippi", cities: ["Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi", "Tupelo"] },
  { code: "MO", name: "Missouri", cities: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence", "Lee's Summit", "O'Fallon", "St. Charles"] },
  { code: "MT", name: "Montana", cities: ["Billings", "Missoula", "Great Falls", "Bozeman", "Helena", "Kalispell"] },
  { code: "NE", name: "Nebraska", cities: ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney"] },
  { code: "NV", name: "Nevada", cities: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City"] },
  { code: "NH", name: "New Hampshire", cities: ["Manchester", "Nashua", "Concord", "Dover", "Rochester", "Portsmouth"] },
  { code: "NJ", name: "New Jersey", cities: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Edison", "Woodbridge", "Lakewood", "Toms River", "Hamilton", "Trenton", "Princeton"] },
  { code: "NM", name: "New Mexico", cities: ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell"] },
  { code: "NY", name: "New York", cities: ["New York City", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany", "New Rochelle", "Mount Vernon", "Schenectady", "White Plains"] },
  { code: "NC", name: "North Carolina", cities: ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville", "Cary", "Wilmington", "High Point", "Asheville", "Concord"] },
  { code: "ND", name: "North Dakota", cities: ["Fargo", "Bismarck", "Grand Forks", "Minot"] },
  { code: "OH", name: "Ohio", cities: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Parma", "Canton", "Youngstown"] },
  { code: "OK", name: "Oklahoma", cities: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Edmond", "Lawton"] },
  { code: "OR", name: "Oregon", cities: ["Portland", "Eugene", "Salem", "Gresham", "Hillsboro", "Beaverton", "Bend", "Medford"] },
  { code: "PA", name: "Pennsylvania", cities: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton", "Bethlehem", "Lancaster", "Harrisburg"] },
  { code: "RI", name: "Rhode Island", cities: ["Providence", "Warwick", "Cranston", "Pawtucket", "Newport"] },
  { code: "SC", name: "South Carolina", cities: ["Charleston", "Columbia", "North Charleston", "Mount Pleasant", "Rock Hill", "Greenville", "Summerville", "Myrtle Beach"] },
  { code: "SD", name: "South Dakota", cities: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings"] },
  { code: "TN", name: "Tennessee", cities: ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville", "Murfreesboro", "Franklin", "Jackson"] },
  { code: "TX", name: "Texas", cities: ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso", "Arlington", "Corpus Christi", "Plano", "Lubbock", "Laredo", "Garland", "Irving", "Frisco", "McKinney", "Amarillo", "Grand Prairie", "Brownsville", "Killeen", "Pasadena", "Mesquite", "McAllen", "Waco", "Round Rock", "Sugar Land", "The Woodlands"] },
  { code: "UT", name: "Utah", cities: ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem", "Sandy", "Ogden", "St. George", "Lehi"] },
  { code: "VT", name: "Vermont", cities: ["Burlington", "South Burlington", "Rutland", "Montpelier"] },
  { code: "VA", name: "Virginia", cities: ["Virginia Beach", "Norfolk", "Chesapeake", "Richmond", "Newport News", "Alexandria", "Hampton", "Roanoke", "Arlington", "Fredericksburg", "Charlottesville"] },
  { code: "WA", name: "Washington", cities: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kent", "Everett", "Renton", "Federal Way", "Yakima", "Bellingham"] },
  { code: "WV", name: "West Virginia", cities: ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling"] },
  { code: "WI", name: "Wisconsin", cities: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton", "Waukesha", "Eau Claire"] },
  { code: "WY", name: "Wyoming", cities: ["Cheyenne", "Casper", "Laramie", "Gillette", "Jackson"] },
  { code: "DC", name: "District of Columbia", cities: ["Washington"] },
];

export function getCitiesForState(stateCode: string): string[] {
  return US_STATES.find((s) => s.code === stateCode)?.cities ?? [];
}

const STATE_BY_CODE = new Map(US_STATES.map((s) => [s.code.toUpperCase(), s]));
const STATE_BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s]));

const CITY_INDEX: Array<{ city: string; state: string; code: string }> = [];
for (const s of US_STATES) {
  for (const c of s.cities) {
    CITY_INDEX.push({ city: c, state: s.name, code: s.code });
  }
}

// Regional aliases → list of canonical "City, ST" entries.
const REGION_ALIASES: Record<string, string[]> = {
  "dmv": ["Washington, DC", "Arlington, VA", "Bethesda, MD"],
  "dfw": ["Dallas, TX", "Fort Worth, TX"],
  "bay area": ["San Francisco, CA", "Oakland, CA", "San Jose, CA"],
  "socal": ["Los Angeles, CA", "San Diego, CA"],
  "nyc": ["New York City, NY"],
  "south florida": ["Miami, FL", "Fort Lauderdale, FL", "West Palm Beach, FL"],
  "tri-state": ["New York City, NY", "Jersey City, NJ", "Stamford, CT"],
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

/** Try to resolve one user-typed token to one or more "City, ST" entries. */
export function resolveLocationToken(raw: string): string[] {
  const input = raw.trim();
  if (!input) return [];
  const low = norm(input);

  // Regional alias
  if (REGION_ALIASES[low]) return REGION_ALIASES[low];

  // "City, ST" or "City, State Name"
  const m = input.match(/^([A-Za-z .'-]+?)\s*,\s*([A-Za-z .]+)$/);
  if (m) {
    const cityPart = m[1].trim();
    const statePart = m[2].trim();
    let stateCode: string | null = null;
    if (statePart.length === 2) {
      const st = STATE_BY_CODE.get(statePart.toUpperCase());
      if (st) stateCode = st.code;
    } else {
      const st = STATE_BY_NAME.get(statePart.toLowerCase());
      if (st) stateCode = st.code;
    }
    if (!stateCode) return [];
    // Find matching city case-insensitively
    const cityNorm = norm(cityPart);
    const match = CITY_INDEX.find(
      (c) => c.code === stateCode && norm(c.city) === cityNorm,
    );
    if (match) return [`${match.city}, ${match.code}`];
    // Accept user-typed city even if not in our short list, as long as state is valid
    const titled = cityPart
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return [`${titled}, ${stateCode}`];
  }

  // Bare state name or code → do NOT auto-expand. Require the user to name
  // specific cities. Returning [] makes the caller mark this token as rejected
  // so we can prompt for a concrete city.
  if (low.length === 2 && STATE_BY_CODE.has(low.toUpperCase())) return [];
  if (STATE_BY_NAME.has(low)) return [];

  // Bare city: search across index; if exactly one match, accept; if multiple, return all but cap 3
  const cityMatches = CITY_INDEX.filter((c) => norm(c.city) === low);
  if (cityMatches.length === 1) return [`${cityMatches[0].city}, ${cityMatches[0].code}`];
  if (cityMatches.length > 1) {
    // Ambiguous — return empty so caller can ask user to disambiguate
    return [];
  }

  return [];
}

/** Parse a free-text city list and return { accepted, rejected }. */
export function parseCityList(content: string): { accepted: string[]; rejected: string[] } {
  const tokens = content
    .split(/\n|;|\band\b|\/| - /i)
    .flatMap((part) => {
      // Split on commas only when it doesn't look like "City, ST" (state token is 2 letters)
      const segs: string[] = [];
      let buf = "";
      const pieces = part.split(",");
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i].trim();
        const next = pieces[i + 1]?.trim() ?? "";
        if (buf) {
          buf += ", " + p;
          segs.push(buf);
          buf = "";
        } else if (next.length === 2 && /^[A-Za-z]{2}$/.test(next)) {
          buf = p;
        } else {
          segs.push(p);
        }
      }
      if (buf) segs.push(buf);
      return segs;
    })
    .map((t) => t.trim())
    .filter(Boolean);

  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const t of tokens) {
    const resolved = resolveLocationToken(t);
    if (resolved.length) accepted.push(...resolved);
    else rejected.push(t);
  }
  // De-dup
  return {
    accepted: [...new Set(accepted)],
    rejected: [...new Set(rejected)],
  };
}