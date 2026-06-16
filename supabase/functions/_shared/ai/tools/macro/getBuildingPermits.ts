/**
 * get_building_permits — Census Building Permits Survey (BPS) data
 * for a specific metro (CBSA). Returns YTD permits authorized broken
 * out by single-family vs multi-family, plus YoY change. National
 * totals only as a last-resort fallback.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { FRED_SERIES } from '../../../fred-series.ts';
import { resolveCbsa } from '../../../census-geo.ts';
import { getSeriesSafe } from './fredHelper.ts';

export const GET_BUILDING_PERMITS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_building_permits',
    description:
      'Returns per-metro building permits authorized (single-family vs multi-family, YTD with YoY change) from the Census Building Permits Survey. Covered: top 50 US metros. If no metro is supplied or the metro is uncovered, falls back to national totals from FRED with a flag. Use this when the user asks about new construction activity, supply pipeline, or whether builders are pulling back in a specific metro.',
    parameters: {
      type: 'object',
      properties: {
        metro_name: {
          type: 'string',
          description: 'Metro name, e.g. "Austin" or "Austin, TX". Optional; omit for national totals.',
        },
      },
      required: [],
    },
  },
};

function svc() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

const CENSUS_API_KEY = Deno.env.get('CENSUS_API_KEY') ?? '';
const BPS_TTL_MINUTES = 60 * 24 * 7; // BPS is monthly; 7d cache plenty

/**
 * Census BPS variables (annual file):
 *   VALUE0 = total units permitted (YTD)
 *   VALUE1 = single-family units
 *   VALUE2 = 2-unit
 *   VALUE3 = 3-4 unit
 *   VALUE4 = 5+ unit
 * Endpoint: https://api.census.gov/data/{year}/eits/bps
 */
async function fetchBpsAnnual(cbsa: string, year: number) {
  const params = new URLSearchParams({
    get: 'cell_value,data_type_code,time_slot_id',
    for: `metropolitan statistical area/micropolitan statistical area:${cbsa}`,
    seasonally_adj: 'no',
    category_code: 'TOTAL',
    time: String(year),
  });
  if (CENSUS_API_KEY) params.set('key', CENSUS_API_KEY);
  const url = `https://api.census.gov/data/${year}/eits/bps?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Census BPS ${res.status}`);
  return (await res.json()) as string[][];
}

async function nationalFallback() {
  const [starts, permits] = await Promise.all([
    getSeriesSafe(FRED_SERIES.HOUSING_STARTS, 24),
    getSeriesSafe(FRED_SERIES.BUILDING_PERMITS, 24),
  ]);
  return {
    ok: true,
    scope: 'national_fallback' as const,
    metro: null,
    housing_starts_thousands: starts.ok ? starts.payload.latest?.value ?? null : null,
    housing_starts_yoy_pct:
      starts.ok && starts.payload.change_yoy ? starts.payload.change_yoy.percent_pts ?? null : null,
    housing_starts_as_of: starts.ok ? starts.payload.latest?.date ?? null : null,
    building_permits_thousands: permits.ok ? permits.payload.latest?.value ?? null : null,
    building_permits_yoy_pct:
      permits.ok && permits.payload.change_yoy ? permits.payload.change_yoy.percent_pts ?? null : null,
    building_permits_as_of: permits.ok ? permits.payload.latest?.date ?? null : null,
    source: 'FRED · HOUST / PERMIT (national fallback)',
  };
}

export async function runGetBuildingPermits(input?: { metro_name?: unknown }) {
  const name = typeof input?.metro_name === 'string' ? input.metro_name.trim() : '';
  if (!name) return await nationalFallback();
  const cbsa = resolveCbsa(name);
  if (!cbsa) {
    const fb = await nationalFallback();
    return {
      ...fb,
      note: `Metro "${name}" not in Census BPS top-50 map — returning national totals.`,
    };
  }

  const cacheKey = `census_bps_${cbsa.cbsa}`;
  const supabase = svc();
  const { data: cached } = await supabase
    .from('census_cache')
    .select('payload, cached_at, ttl_minutes')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  if (cached) {
    const ageMin = (Date.now() - new Date(cached.cached_at as string).getTime()) / 60000;
    if (ageMin < (cached.ttl_minutes as number)) {
      return cached.payload as Record<string, unknown>;
    }
  }

  try {
    const now = new Date();
    const year = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    const [current, prior] = await Promise.all([
      fetchBpsAnnual(cbsa.cbsa, year).catch(() => null),
      fetchBpsAnnual(cbsa.cbsa, year - 1).catch(() => null),
    ]);

    function parseUnits(rows: string[][] | null): { total: number | null; single: number | null; multi: number | null } {
      if (!rows || rows.length < 2) return { total: null, single: null, multi: null };
      // header: ["cell_value","data_type_code","time_slot_id",...]
      const header = rows[0];
      const codeIdx = header.indexOf('data_type_code');
      const valIdx = header.indexOf('cell_value');
      let total = 0,
        single = 0,
        multi = 0;
      let any = false;
      for (const r of rows.slice(1)) {
        const code = (r[codeIdx] || '').toUpperCase();
        const v = Number(r[valIdx]);
        if (!Number.isFinite(v)) continue;
        any = true;
        if (code === 'TOTAL') total += v;
        else if (code === 'UNITS_1' || code === 'SF') single += v;
        else if (
          code === 'UNITS_2' ||
          code === 'UNITS_34' ||
          code === 'UNITS_5MO' ||
          code === 'MF'
        )
          multi += v;
      }
      return any
        ? { total: total || null, single: single || null, multi: multi || null }
        : { total: null, single: null, multi: null };
    }

    const cur = parseUnits(current);
    const pri = parseUnits(prior);
    const yoyPct = (a: number | null, b: number | null) =>
      a != null && b != null && b > 0 ? +(((a - b) / b) * 100).toFixed(1) : null;

    const payload = {
      ok: true,
      scope: 'metro' as const,
      metro: cbsa.name,
      cbsa: cbsa.cbsa,
      year,
      total_units_ytd: cur.total,
      total_units_yoy_pct: yoyPct(cur.total, pri.total),
      single_family_units_ytd: cur.single,
      single_family_yoy_pct: yoyPct(cur.single, pri.single),
      multi_family_units_ytd: cur.multi,
      multi_family_yoy_pct: yoyPct(cur.multi, pri.multi),
      source: `Census Building Permits Survey · CBSA ${cbsa.cbsa}`,
    };

    await supabase.from('census_cache').upsert(
      { cache_key: cacheKey, payload, cached_at: new Date().toISOString(), ttl_minutes: BPS_TTL_MINUTES },
      { onConflict: 'cache_key' },
    );
    return payload;
  } catch (e) {
    const fb = await nationalFallback();
    return {
      ...fb,
      note: `Metro BPS fetch failed (${e instanceof Error ? e.message : String(e)}); returning national totals.`,
    };
  }
}