/**
 * Census ACS 5-year client with cache-first reads against `census_cache`.
 * Census ACS is annual; default TTL = 7 days.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CENSUS_API_KEY = Deno.env.get('CENSUS_API_KEY') ?? '';
const ACS_YEAR = '2023'; // Most recent ACS 5-yr release. Bump annually.
const ACS_DATASET = 'acs/acs5';

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

export interface CensusFetchOptions {
  variables: string[];
  /** Geography clause, e.g. "for=place:53000&in=state:48". */
  geography: string;
  /** Cache key for census_cache table. */
  cacheKey: string;
  /** TTL in minutes. Default 7d. */
  ttlMinutes?: number;
  force?: boolean;
}

export interface CensusResponse {
  variables: string[];
  values: Record<string, number | null>;
  cached: boolean;
  fetched_at: string;
}

function parseAcsRow(headers: string[], row: string[], requested: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const v of requested) {
    const idx = headers.indexOf(v);
    if (idx < 0) {
      out[v] = null;
      continue;
    }
    const raw = row[idx];
    const n = Number(raw);
    out[v] = Number.isFinite(n) ? n : null;
  }
  return out;
}

async function fetchFromCensus(opts: CensusFetchOptions): Promise<Record<string, number | null>> {
  const vars = ['NAME', ...opts.variables].join(',');
  const keyParam = CENSUS_API_KEY ? `&key=${CENSUS_API_KEY}` : '';
  const url = `https://api.census.gov/data/${ACS_YEAR}/${ACS_DATASET}?get=${vars}&${opts.geography}${keyParam}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Census API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as string[][];
  if (!Array.isArray(data) || data.length < 2) {
    throw new Error('Census API returned empty/invalid response');
  }
  return parseAcsRow(data[0], data[1], opts.variables);
}

export async function getCensusData(opts: CensusFetchOptions): Promise<CensusResponse> {
  const ttlMinutes = opts.ttlMinutes ?? 60 * 24 * 7;
  const supabase = getServiceClient();

  if (!opts.force) {
    const { data: cached } = await supabase
      .from('census_cache')
      .select('payload, cached_at, ttl_minutes')
      .eq('cache_key', opts.cacheKey)
      .maybeSingle();
    if (cached) {
      const ageMin = (Date.now() - new Date(cached.cached_at as string).getTime()) / 60000;
      if (ageMin < (cached.ttl_minutes as number)) {
        return {
          variables: opts.variables,
          values: cached.payload as Record<string, number | null>,
          cached: true,
          fetched_at: cached.cached_at as string,
        };
      }
    }
  }

  const values = await fetchFromCensus(opts);
  const fetched_at = new Date().toISOString();
  await supabase.from('census_cache').upsert(
    { cache_key: opts.cacheKey, payload: values, cached_at: fetched_at, ttl_minutes: ttlMinutes },
    { onConflict: 'cache_key' },
  );

  return { variables: opts.variables, values, cached: false, fetched_at };
}

/** Common ACS variables used by HomeLens. */
export const ACS_VARS = {
  POPULATION: 'B01003_001E',
  MEDIAN_HOUSEHOLD_INCOME: 'B19013_001E',
  MEDIAN_AGE: 'B01002_001E',
  TOTAL_HOUSING_UNITS: 'B25001_001E',
  OWNER_OCCUPIED: 'B25003_002E',
  TOTAL_OCCUPIED: 'B25003_001E',
  MEDIAN_HOME_VALUE: 'B25077_001E',
  MEDIAN_GROSS_RENT: 'B25064_001E',
  BACHELORS_OR_HIGHER: 'B15003_022E',
  POP_25_PLUS: 'B15003_001E',
} as const;

export const CURRENT_ACS_YEAR = ACS_YEAR;