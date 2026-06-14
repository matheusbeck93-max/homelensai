/**
 * Open Houses Search edge function.
 *
 * Flow:
 *   1. Auth + tier resolution
 *   2. Free-tier daily-quota check (5/day)
 *   3. 30-min cache hit on `open_house_cache` keyed by filter hash
 *   4. Firecrawl scrape of Redfin → Realtor with JSON-schema extraction
 *   5. Normalize, cache, return
 */

import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { requireEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';
import { loadUserTier } from '../_shared/tierGate.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { findOpenHousesSchema, type FindOpenHousesArgs } from '../_shared/openHouses/tool.ts';
import type { OpenHouseListing, OpenHouseSearchResult } from '../_shared/openHouses/types.ts';
import { checkAndIncrementOpenHouseQuota } from '../_shared/openHouses/limiter.ts';

const log = createLogger('open-houses-search');
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_LISTINGS = 25;

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildFilterHash(f: FindOpenHousesArgs): Promise<string> {
  return sha256(JSON.stringify({
    country: f.country,
    state: (f.state ?? '').toLowerCase(),
    city: (f.city ?? '').toLowerCase(),
    dateFrom: f.dateFrom ?? '',
    dateTo: f.dateTo ?? '',
    priceMin: f.priceMin ?? 0,
    priceMax: f.priceMax ?? 0,
  }));
}

function slugifyCity(city: string): string {
  return city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildRedfinUrl(f: FindOpenHousesArgs): string | null {
  if (!f.city || !f.state) return null;
  const citySlug = slugifyCity(f.city);
  const path = `${f.state.toUpperCase()}/${citySlug}/filter/include=open-house`;
  const filters: string[] = [];
  if (f.priceMin) filters.push(`min-price=${f.priceMin}`);
  if (f.priceMax) filters.push(`max-price=${f.priceMax}`);
  const filterTail = filters.length ? `,${filters.join(',')}` : '';
  return `https://www.redfin.com/city/${path}${filterTail}`;
}

function buildRealtorUrl(f: FindOpenHousesArgs): string | null {
  if (!f.city || !f.state) return null;
  const citySlug = slugifyCity(f.city);
  const base = `https://www.realtor.com/realestateandhomes-search/${citySlug}_${f.state.toUpperCase()}/show-open-house-only`;
  const params: string[] = [];
  if (f.priceMin) params.push(`price-${f.priceMin}-na`);
  if (f.priceMax) params.push(`price-na-${f.priceMax}`);
  return params.length ? `${base}/${params.join('/')}` : base;
}

const SCRAPE_SCHEMA = {
  type: 'object',
  properties: {
    listings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          zip: { type: 'string' },
          price: { type: 'number' },
          beds: { type: 'number' },
          baths: { type: 'number' },
          sqft: { type: 'number' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          photo: { type: 'string' },
          listingUrl: { type: 'string' },
          openHouseStart: { type: 'string', description: 'ISO datetime for the next upcoming open house.' },
          openHouseEnd: { type: 'string', description: 'ISO datetime for end of next open house.' },
        },
      },
    },
  },
};

interface RawListing {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  lat?: number;
  lng?: number;
  photo?: string;
  listingUrl?: string;
  openHouseStart?: string;
  openHouseEnd?: string;
}

async function callFirecrawl(url: string, apiKey: string): Promise<RawListing[]> {
  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      formats: [{ type: 'json', schema: SCRAPE_SCHEMA, prompt: 'Extract all listings with upcoming open houses on this page. Return an array.' }],
      onlyMainContent: true,
      waitFor: 4000,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    log.error('Firecrawl error', { status: res.status, body: txt.slice(0, 300) });
    return [];
  }
  const data = await res.json();
  const json = data?.data?.json ?? data?.json ?? null;
  const arr = Array.isArray(json?.listings) ? json.listings : [];
  return arr as RawListing[];
}

function normalize(
  raw: RawListing[],
  source: 'redfin' | 'realtor',
  country: 'US' | 'CA',
): OpenHouseListing[] {
  const out: OpenHouseListing[] = [];
  for (const r of raw) {
    if (!r.address || !r.price) continue;
    const id = `${source}-${(r.listingUrl || r.address).slice(0, 80)}`;
    out.push({
      id,
      address: r.address,
      city: r.city ?? '',
      state: r.state ?? '',
      zip: r.zip ?? null,
      country,
      price: Number(r.price),
      beds: Number(r.beds ?? 0),
      baths: Number(r.baths ?? 0),
      sqft: r.sqft ?? null,
      lat: r.lat ?? null,
      lng: r.lng ?? null,
      photo: r.photo ?? null,
      listingUrl: r.listingUrl ?? '',
      source,
      openHouses: r.openHouseStart && r.openHouseEnd
        ? [{ start: r.openHouseStart, end: r.openHouseEnd, type: 'in-person' }]
        : [],
    });
  }
  return out.slice(0, MAX_LISTINGS);
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = findOpenHousesSchema.safeParse(body);
    if (!parsed.success) return validationError('Invalid filters', parsed.error.flatten());
    const filters = parsed.data;

    const { tier, userId } = await loadUserTier(req);

    const quota = await checkAndIncrementOpenHouseQuota(userId, tier);
    if (!quota.allowed) {
      return new Response(JSON.stringify({ error: 'quota_exceeded', message: quota.reason, limit: quota.limit }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hash = await buildFilterHash(filters);

    const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false },
    });

    const { data: cached } = await supabase
      .from('open_house_cache')
      .select('results, fetched_at')
      .eq('filter_hash', hash)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at as string).getTime();
      if (age < CACHE_TTL_MS) {
        const limitedListings = (cached.results as OpenHouseListing[]).slice(
          0,
          tier === 'free' ? 10 : MAX_LISTINGS,
        );
        const result: OpenHouseSearchResult = {
          listings: limitedListings,
          fetchedAt: cached.fetched_at as string,
          fromCache: true,
          remainingQuota: Number.isFinite(quota.remaining) ? quota.remaining : null,
        };
        return jsonResponse(result, 200, req);
      }
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) return errorResponse('Open-house search is not configured.', 503, req);

    const redfinUrl = buildRedfinUrl(filters);
    const realtorUrl = buildRealtorUrl(filters);

    let listings: OpenHouseListing[] = [];
    if (redfinUrl) {
      const raw = await callFirecrawl(redfinUrl, firecrawlKey);
      listings = normalize(raw, 'redfin', filters.country);
    }
    if (listings.length === 0 && realtorUrl) {
      const raw = await callFirecrawl(realtorUrl, firecrawlKey);
      listings = normalize(raw, 'realtor', filters.country);
    }

    await supabase
      .from('open_house_cache')
      .upsert(
        {
          filter_hash: hash,
          country: filters.country,
          state: filters.state ?? null,
          city: filters.city ?? null,
          results: listings,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'filter_hash' },
      );

    const limitedListings = listings.slice(0, tier === 'free' ? 10 : MAX_LISTINGS);
    const result: OpenHouseSearchResult = {
      listings: limitedListings,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      remainingQuota: Number.isFinite(quota.remaining) ? quota.remaining : null,
    };
    return jsonResponse(result, 200, req);
  } catch (err) {
    log.error('open-houses-search failed', { error: err instanceof Error ? err.message : String(err) });
    return errorResponse('Unable to search open houses right now.', 500, req);
  }
});
