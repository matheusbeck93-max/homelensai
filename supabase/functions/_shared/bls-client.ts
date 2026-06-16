/**
 * Bureau of Labor Statistics public API v2 client with cache-first reads
 * against `bls_cache`.
 *
 * - LAUS (Local Area Unemployment Statistics): monthly metro unemployment
 *   rate + labor force size. Series ID pattern:
 *     LAUMT<MSA_CODE>000000003  (unemployment rate)
 *     LAUMT<MSA_CODE>000000006  (labor force)
 * - OEWS (Occupational Employment & Wage Statistics): annual median wage
 *   by metro. Series ID pattern: OEUM<MSA>000000000000004 (annual median
 *   wage, all occupations).
 *
 * BLS_API_KEY is optional (without it: 25 queries/day, 10 series/query;
 * with it: 500 queries/day, 50 series/query).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const BLS_API_KEY = Deno.env.get('BLS_API_KEY') ?? '';
const BLS_ENDPOINT = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

function svc() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

export interface BlsObservation {
  year: string;
  period: string;
  periodName: string;
  value: number | null;
}

export interface BlsSeriesPayload {
  seriesId: string;
  observations: BlsObservation[];
  latest: BlsObservation | null;
}

export interface GetBlsOptions {
  seriesIds: string[];
  startYear?: number;
  endYear?: number;
  ttlMinutes?: number;
  cacheKey: string;
  force?: boolean;
}

export async function getBlsSeries(
  opts: GetBlsOptions,
): Promise<Record<string, BlsSeriesPayload>> {
  const ttlMinutes = opts.ttlMinutes ?? 60 * 24; // monthly data -> 1d cache
  const supabase = svc();

  if (!opts.force) {
    const { data: cached } = await supabase
      .from('bls_cache')
      .select('payload, cached_at, ttl_minutes')
      .eq('cache_key', opts.cacheKey)
      .maybeSingle();
    if (cached) {
      const ageMin = (Date.now() - new Date(cached.cached_at as string).getTime()) / 60000;
      if (ageMin < (cached.ttl_minutes as number)) {
        return cached.payload as Record<string, BlsSeriesPayload>;
      }
    }
  }

  const now = new Date();
  const startYear = String(opts.startYear ?? now.getFullYear() - 2);
  const endYear = String(opts.endYear ?? now.getFullYear());

  const body: Record<string, unknown> = {
    seriesid: opts.seriesIds,
    startyear: startYear,
    endyear: endYear,
  };
  if (BLS_API_KEY) body.registrationkey = BLS_API_KEY;

  const res = await fetch(BLS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`BLS API ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS API error: ${json.message?.join('; ') ?? json.status}`);
  }

  const out: Record<string, BlsSeriesPayload> = {};
  for (const s of json.Results?.series ?? []) {
    const obs: BlsObservation[] = (s.data ?? []).map((d: Record<string, string>) => ({
      year: d.year,
      period: d.period,
      periodName: d.periodName,
      value: Number.isFinite(Number(d.value)) ? Number(d.value) : null,
    }));
    obs.sort((a, b) => (a.year + a.period).localeCompare(b.year + b.period));
    out[s.seriesID] = { seriesId: s.seriesID, observations: obs, latest: obs[obs.length - 1] ?? null };
  }

  await supabase.from('bls_cache').upsert(
    { cache_key: opts.cacheKey, payload: out, cached_at: new Date().toISOString(), ttl_minutes: ttlMinutes },
    { onConflict: 'cache_key' },
  );

  return out;
}

/** LAUS series-ID builders (MSA = 7-digit code; "M" prefix removed). */
export const blsLaus = {
  unemploymentRate: (msa: string) => `LAUMT${msa}000000003`,
  laborForce: (msa: string) => `LAUMT${msa}000000006`,
};

/** OEWS annual median wage (all occupations) for a metro. */
export const blsOews = {
  medianAnnualWageAllOcc: (msa: string) => `OEUM${msa}000000000000004`,
};

/**
 * Tiny built-in CBSA lookup (top metros). Returns the 7-digit MSA code BLS
 * uses, derived from the OMB CBSA code minus the leading 0 padding nuance.
 * Returns null for unknown metros.
 */
export const TOP_MSA_CODES: Record<string, { code: string; name: string }> = {
  'new york': { code: '3562000', name: 'New York-Newark-Jersey City, NY-NJ-PA' },
  'los angeles': { code: '3108000', name: 'Los Angeles-Long Beach-Anaheim, CA' },
  chicago: { code: '1698000', name: 'Chicago-Naperville-Elgin, IL-IN-WI' },
  dallas: { code: '1910000', name: 'Dallas-Fort Worth-Arlington, TX' },
  houston: { code: '2642000', name: 'Houston-The Woodlands-Sugar Land, TX' },
  washington: { code: '4790000', name: 'Washington-Arlington-Alexandria, DC-VA-MD-WV' },
  miami: { code: '3310000', name: 'Miami-Fort Lauderdale-Pompano Beach, FL' },
  philadelphia: { code: '3798000', name: 'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD' },
  atlanta: { code: '1206000', name: 'Atlanta-Sandy Springs-Alpharetta, GA' },
  phoenix: { code: '3806000', name: 'Phoenix-Mesa-Chandler, AZ' },
  boston: { code: '1471000', name: 'Boston-Cambridge-Newton, MA-NH' },
  'san francisco': { code: '4186000', name: 'San Francisco-Oakland-Berkeley, CA' },
  seattle: { code: '4266000', name: 'Seattle-Tacoma-Bellevue, WA' },
  denver: { code: '1974000', name: 'Denver-Aurora-Lakewood, CO' },
  austin: { code: '1242000', name: 'Austin-Round Rock-Georgetown, TX' },
  tampa: { code: '4530000', name: 'Tampa-St. Petersburg-Clearwater, FL' },
  charlotte: { code: '1652000', name: 'Charlotte-Concord-Gastonia, NC-SC' },
  portland: { code: '3890000', name: 'Portland-Vancouver-Hillsboro, OR-WA' },
  nashville: { code: '3498000', name: 'Nashville-Davidson--Murfreesboro--Franklin, TN' },
  raleigh: { code: '3958000', name: 'Raleigh-Cary, NC' },
};

export function resolveMsa(input: string): { code: string; name: string } | null {
  const key = input.toLowerCase().split(',')[0].trim();
  return TOP_MSA_CODES[key] ?? null;
}