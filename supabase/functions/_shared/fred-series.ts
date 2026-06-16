/**
 * FRED (Federal Reserve Economic Data) series catalog.
 *
 * Curated set of high-value series for HomeLens macro intelligence:
 * mortgage rates, rate drivers, housing indices, macro indicators.
 * Each entry maps to a stable FRED series ID; TTLs are picked based on
 * the release cadence so cache reads stay fresh without hammering FRED.
 */

export const FRED_SERIES = {
  // Mortgage rates
  MORTGAGE_30Y: 'MORTGAGE30US',
  MORTGAGE_15Y: 'MORTGAGE15US',

  // Rate environment / drivers
  FED_FUNDS: 'FEDFUNDS',
  FED_FUNDS_DAILY: 'DFF',
  TREASURY_10Y: 'DGS10',
  UNEMPLOYMENT: 'UNRATE',
  CPI: 'CPIAUCSL',
  CORE_CPI: 'CPILFESL',

  // National housing
  CASE_SHILLER_NATL: 'CSUSHPISA',
  MEDIAN_SALES_PRICE: 'MSPUS',
  NEW_HOMES_SOLD: 'HSN1F',
  HOUSING_STARTS: 'HOUST',
  EXISTING_HOME_SALES: 'EXHOSLUSM495S',
  HOMEOWNERSHIP_RATE: 'RHORUSQ156N',

  // Income
  REAL_MEDIAN_HHI: 'MEHOINUSA672N',
} as const;

/** Case-Shiller 20-city regional indices (seasonally adjusted). */
export const CASE_SHILLER_METROS = {
  ATLANTA: 'ATXRSA',
  BOSTON: 'BOXRSA',
  CHARLOTTE: 'CRXRSA',
  CHICAGO: 'CHXRSA',
  CLEVELAND: 'CEXRSA',
  DALLAS: 'DAXRSA',
  DENVER: 'DNXRSA',
  DETROIT: 'DEXRSA',
  LAS_VEGAS: 'LVXRSA',
  LOS_ANGELES: 'LXXRSA',
  MIAMI: 'MIXRSA',
  MINNEAPOLIS: 'MNXRSA',
  NEW_YORK: 'NYXRSA',
  PHOENIX: 'PHXRSA',
  PORTLAND: 'POXRSA',
  SAN_DIEGO: 'SDXRSA',
  SAN_FRANCISCO: 'SFXRSA',
  SEATTLE: 'SEXRSA',
  TAMPA: 'TPXRSA',
  WASHINGTON_DC: 'WDXRSA',
} as const;

/**
 * Loose city/metro string → Case-Shiller series resolver.
 * Returns `{ seriesId, fallback }` — `fallback` is true when we fall
 * back to the national index because the requested metro isn't part of
 * the 20-city coverage.
 */
export function resolveCaseShillerSeries(input: string): {
  seriesId: string;
  metroLabel: string;
  fallback: boolean;
} {
  const key = input.trim().toLowerCase();
  const lookup: Record<string, [keyof typeof CASE_SHILLER_METROS, string]> = {
    'atlanta': ['ATLANTA', 'Atlanta, GA'],
    'boston': ['BOSTON', 'Boston, MA'],
    'charlotte': ['CHARLOTTE', 'Charlotte, NC'],
    'chicago': ['CHICAGO', 'Chicago, IL'],
    'cleveland': ['CLEVELAND', 'Cleveland, OH'],
    'dallas': ['DALLAS', 'Dallas, TX'],
    'denver': ['DENVER', 'Denver, CO'],
    'detroit': ['DETROIT', 'Detroit, MI'],
    'las vegas': ['LAS_VEGAS', 'Las Vegas, NV'],
    'vegas': ['LAS_VEGAS', 'Las Vegas, NV'],
    'los angeles': ['LOS_ANGELES', 'Los Angeles, CA'],
    'la': ['LOS_ANGELES', 'Los Angeles, CA'],
    'miami': ['MIAMI', 'Miami, FL'],
    'minneapolis': ['MINNEAPOLIS', 'Minneapolis, MN'],
    'new york': ['NEW_YORK', 'New York, NY'],
    'nyc': ['NEW_YORK', 'New York, NY'],
    'phoenix': ['PHOENIX', 'Phoenix, AZ'],
    'portland': ['PORTLAND', 'Portland, OR'],
    'san diego': ['SAN_DIEGO', 'San Diego, CA'],
    'san francisco': ['SAN_FRANCISCO', 'San Francisco, CA'],
    'sf': ['SAN_FRANCISCO', 'San Francisco, CA'],
    'seattle': ['SEATTLE', 'Seattle, WA'],
    'tampa': ['TPXRSA' as any, 'Tampa, FL'] as any,
    'washington': ['WASHINGTON_DC', 'Washington, DC'],
    'dc': ['WASHINGTON_DC', 'Washington, DC'],
    'washington dc': ['WASHINGTON_DC', 'Washington, DC'],
  };
  const cleaned = key.replace(/,.*$/, '').replace(/\s+/g, ' ').trim();
  const hit = lookup[cleaned];
  if (hit) {
    const [metroKey, label] = hit;
    const seriesId = (CASE_SHILLER_METROS as Record<string, string>)[metroKey as string];
    return { seriesId, metroLabel: label, fallback: false };
  }
  return {
    seriesId: FRED_SERIES.CASE_SHILLER_NATL,
    metroLabel: `${input} (national index — metro not in Case-Shiller 20-city coverage)`,
    fallback: true,
  };
}

/**
 * TTL in minutes for a given series, based on its release cadence.
 * - Daily series: 1 hour
 * - Weekly series: 6 hours
 * - Monthly / quarterly: 24 hours
 * - Annual: 7 days
 */
export function ttlMinutesForSeries(seriesId: string): number {
  const daily = new Set<string>([FRED_SERIES.FED_FUNDS_DAILY, FRED_SERIES.TREASURY_10Y]);
  const weekly = new Set<string>([FRED_SERIES.MORTGAGE_30Y, FRED_SERIES.MORTGAGE_15Y]);
  const annual = new Set<string>([FRED_SERIES.REAL_MEDIAN_HHI]);
  if (daily.has(seriesId)) return 60;
  if (weekly.has(seriesId)) return 60 * 6;
  if (annual.has(seriesId)) return 60 * 24 * 7;
  // Monthly / quarterly default
  return 60 * 24;
}

/** Series that the daily prefetch cron warms up. */
export const PREFETCH_SERIES: string[] = [
  FRED_SERIES.MORTGAGE_30Y,
  FRED_SERIES.MORTGAGE_15Y,
  FRED_SERIES.FED_FUNDS_DAILY,
  FRED_SERIES.TREASURY_10Y,
  FRED_SERIES.CASE_SHILLER_NATL,
  FRED_SERIES.UNEMPLOYMENT,
  FRED_SERIES.CPI,
  ...Object.values(CASE_SHILLER_METROS),
];