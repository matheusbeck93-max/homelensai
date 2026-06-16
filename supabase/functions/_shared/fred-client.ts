/**
 * Shared FRED fetch helper used by fred-get-series, fred-mortgage-snapshot
 * and fred-prefetch-daily. Cache-first: reads `fred_cache`, falls back
 * to the FRED API, then writes the result back.
 *
 * FRED docs: https://fred.stlouisfed.org/docs/api/fred/
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { ttlMinutesForSeries } from './fred-series.ts';

const FRED_BASE = 'https://api.stlouisfed.org/fred';

export interface FredObservation {
  date: string;
  value: number | null;
}

export interface FredSeriesPayload {
  series_id: string;
  title: string;
  units: string;
  frequency: string;
  last_updated: string;
  observations: FredObservation[];
  latest: FredObservation | null;
  change_30d: { absolute: number; percent_pts: number } | null;
  change_90d: { absolute: number; percent_pts: number } | null;
  change_yoy: { absolute: number; percent_pts: number } | null;
}

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
}

function computeChange(obs: FredObservation[], targetDate: Date) {
  if (!obs.length) return null;
  const latest = obs[0];
  if (latest.value == null) return null;
  // obs is sorted desc by date
  const target = obs.find((o) => {
    const d = new Date(o.date);
    return d.getTime() <= targetDate.getTime() && o.value != null;
  });
  if (!target || target.value == null) return null;
  const absolute = +(latest.value - target.value).toFixed(4);
  return {
    absolute,
    percent_pts: Math.round(absolute * 100), // basis points for rates
  };
}

async function fetchFromFred(
  seriesId: string,
  opts: { limit?: number; observationStart?: string },
): Promise<FredSeriesPayload> {
  const apiKey = Deno.env.get('FRED_API_KEY');
  if (!apiKey) throw new Error('FRED_API_KEY is not configured');

  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 1000);

  // Fetch metadata + observations in parallel
  const metaUrl = new URL(`${FRED_BASE}/series`);
  metaUrl.searchParams.set('series_id', seriesId);
  metaUrl.searchParams.set('api_key', apiKey);
  metaUrl.searchParams.set('file_type', 'json');

  const obsUrl = new URL(`${FRED_BASE}/series/observations`);
  obsUrl.searchParams.set('series_id', seriesId);
  obsUrl.searchParams.set('api_key', apiKey);
  obsUrl.searchParams.set('file_type', 'json');
  obsUrl.searchParams.set('sort_order', 'desc');
  obsUrl.searchParams.set('limit', String(limit));
  if (opts.observationStart) {
    obsUrl.searchParams.set('observation_start', opts.observationStart);
  }

  const [metaRes, obsRes] = await Promise.all([fetch(metaUrl), fetch(obsUrl)]);
  if (!metaRes.ok) throw new Error(`FRED metadata fetch failed: ${metaRes.status}`);
  if (!obsRes.ok) throw new Error(`FRED observations fetch failed: ${obsRes.status}`);
  const metaJson = await metaRes.json();
  const obsJson = await obsRes.json();

  const meta = metaJson?.seriess?.[0] ?? {};
  const observations: FredObservation[] = (obsJson?.observations ?? []).map(
    (o: { date: string; value: string }) => ({
      date: o.date,
      value: o.value === '.' ? null : Number(o.value),
    }),
  );

  const latest = observations.find((o) => o.value != null) ?? null;
  const now = new Date();
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
  const d365 = new Date(now); d365.setDate(d365.getDate() - 365);

  return {
    series_id: seriesId,
    title: meta.title ?? seriesId,
    units: meta.units ?? '',
    frequency: meta.frequency ?? '',
    last_updated: meta.last_updated ?? '',
    observations,
    latest,
    change_30d: computeChange(observations, d30),
    change_90d: computeChange(observations, d90),
    change_yoy: computeChange(observations, d365),
  };
}

/**
 * Cache-first FRED fetch. If the cached payload is younger than the
 * series' TTL, returns it; otherwise fetches fresh and updates cache.
 * If FRED is unreachable but stale cache exists, returns stale data
 * (fail-soft).
 */
export async function getFredSeries(
  seriesId: string,
  opts: { limit?: number; observationStart?: string; force?: boolean } = {},
): Promise<{ payload: FredSeriesPayload; cacheHit: boolean }> {
  const supabase = getServiceClient();
  const ttl = ttlMinutesForSeries(seriesId);

  if (!opts.force) {
    const { data: cached } = await supabase
      .from('fred_cache')
      .select('payload, cached_at, ttl_minutes')
      .eq('series_id', seriesId)
      .maybeSingle();
    if (cached) {
      const ageMin = (Date.now() - new Date(cached.cached_at).getTime()) / 60000;
      if (ageMin < (cached.ttl_minutes ?? ttl)) {
        return { payload: cached.payload as FredSeriesPayload, cacheHit: true };
      }
    }
  }

  try {
    const payload = await fetchFromFred(seriesId, opts);
    await supabase.from('fred_cache').upsert({
      series_id: seriesId,
      payload,
      cached_at: new Date().toISOString(),
      ttl_minutes: ttl,
    });
    return { payload, cacheHit: false };
  } catch (err) {
    // Fall back to stale cache if available
    const { data: stale } = await supabase
      .from('fred_cache')
      .select('payload')
      .eq('series_id', seriesId)
      .maybeSingle();
    if (stale) return { payload: stale.payload as FredSeriesPayload, cacheHit: true };
    throw err;
  }
}