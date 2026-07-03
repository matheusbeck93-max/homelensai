/**
 * Open Houses Search edge function.
 *
 * Flow:
 *   1. Auth + tier resolution
 *   2. Free-tier daily-quota check (5/day)
 *   3. 30-min cache hit on `open_house_cache` keyed by filter hash
 *   4. Perplexity (primary) → Firecrawl (fallback) via the orchestrator
 *   5. Cache (only when non-empty), return
 *
 * Request body supports `bypass_cache: true` for forced refresh.
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
import { searchOpenHousesOrchestrated, MAX_LISTINGS } from '../_shared/openHouses/dataSources.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const log = createLogger('open-houses-search');
const CACHE_TTL_MS = 30 * 60 * 1000;

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

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => ({}));
    const bypassCache = body?.bypass_cache === true;
    // Strip control fields before Zod validation.
    const { bypass_cache: _ignored, ...filterBody } = (body ?? {}) as Record<string, unknown>;
    const parsed = findOpenHousesSchema.safeParse(filterBody);
    if (!parsed.success) return validationError('Invalid filters', parsed.error.flatten());
    const filters = parsed.data;

    const { tier, userId } = await loadUserTier(req);
    log.info('search request', { tier, userId, filters, bypassCache });

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

    if (!bypassCache) {
      const { data: cached } = await supabase
        .from('open_house_cache')
        .select('results, fetched_at')
        .eq('filter_hash', hash)
        .maybeSingle();

      const cachedListings = Array.isArray(cached?.results) ? (cached!.results as OpenHouseListing[]) : [];
      log.info('cache lookup', { hit: !!cached, cached_count: cachedListings.length });

      if (cached && cachedListings.length > 0) {
        const age = Date.now() - new Date(cached.fetched_at as string).getTime();
        if (age < CACHE_TTL_MS) {
          const limitedListings = cachedListings.slice(0, tier === 'free' ? 10 : MAX_LISTINGS);
          const result: OpenHouseSearchResult = {
            listings: limitedListings,
            fetchedAt: cached.fetched_at as string,
            fromCache: true,
            remainingQuota: Number.isFinite(quota.remaining) ? quota.remaining : null,
          };
          return jsonResponse(result, 200, req);
        }
      }
    }

    const orch = await searchOpenHousesOrchestrated(filters);
    log.info('orchestrator result', {
      primary: orch.primarySource,
      perplexity: orch.perplexityCount,
      firecrawl: orch.firecrawlCount,
      total: orch.listings.length,
    });

    const listings = orch.listings;

    // Only cache non-empty results — prevents 30-min poisoning when both
    // data sources transiently return zero.
    if (listings.length > 0) {
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
    } else {
      log.info('empty result — not caching', { filterHash: hash });
    }

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
})(req)));
