/**
 * Shared Perplexity helper for follow-up registry tools.
 *
 * Wraps Perplexity Sonar with a Supabase `search_cache` layer so repeated
 * lookups (lenders, FTHB programs, neighborhood data, current 30y rate) do
 * not burn quota across cascade steps. Fail-soft: any error returns
 * `{ ok: false }` and lets the caller fall back to an evergreen reply.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface CachedPerplexityResult {
  ok: boolean;
  answer: string;
  citations: string[];
  cached: boolean;
  error?: string;
}

export interface CachedPerplexityOptions {
  /** Stable cache key (already normalized, no PII). */
  cacheKey: string;
  /** `search_cache.source` discriminator, e.g. `followup_lenders`. */
  source: string;
  /** Cache TTL in minutes. Tool-specific (lenders 24h, FTHB 7d, etc.). */
  ttlMinutes: number;
  /** Perplexity user prompt. */
  prompt: string;
  /** System prompt. Keep tight; tools render their own output. */
  system?: string;
  /** `search_recency_filter` passthrough. */
  recency?: 'day' | 'week' | 'month' | 'year';
  /** Restrict Perplexity to specific domains (e.g. HUD, state sites). */
  domainFilter?: string[];
  /** Max tokens. Defaults to 600. */
  maxTokens?: number;
  /** Skip cache read (forced refresh). Still writes the new entry. */
  forceRefresh?: boolean;
}

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function cachedPerplexity(
  opts: CachedPerplexityOptions,
): Promise<CachedPerplexityResult> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) {
    return { ok: false, answer: '', citations: [], cached: false, error: 'PERPLEXITY_API_KEY missing' };
  }

  const supabase = getSupabase();
  const cacheKey = opts.cacheKey.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 200);

  // Cache read
  if (supabase && !opts.forceRefresh) {
    try {
      const { data: cached } = await supabase
        .from('search_cache')
        .select('results, updated_at, ttl_minutes')
        .eq('normalized_query', cacheKey)
        .eq('source', opts.source)
        .maybeSingle();
      if (cached) {
        const ageMin = (Date.now() - new Date(cached.updated_at).getTime()) / 60_000;
        const ttl = Number(cached.ttl_minutes) || opts.ttlMinutes;
        if (ageMin < ttl && cached.results) {
          const r = cached.results as { answer?: string; citations?: string[] };
          return {
            ok: true,
            answer: String(r.answer ?? ''),
            citations: Array.isArray(r.citations) ? r.citations.slice(0, 5) : [],
            cached: true,
          };
        }
      }
    } catch {
      // Cache miss is non-fatal.
    }
  }

  // Live Perplexity call
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);
  try {
    const body: Record<string, unknown> = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content:
            opts.system ??
            'You are a research backend. Return a tight, factual answer (under 250 words) with concrete names, numbers, and dates. No greetings, no caveats.',
        },
        { role: 'user', content: opts.prompt },
      ],
      max_tokens: opts.maxTokens ?? 600,
    };
    if (opts.recency) body.search_recency_filter = opts.recency;
    if (opts.domainFilter?.length) body.search_domain_filter = opts.domainFilter.slice(0, 10);

    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, answer: '', citations: [], cached: false, error: `perplexity ${res.status}` };
    }
    const data = await res.json();
    const answer = String(data?.choices?.[0]?.message?.content ?? '').trim();
    const citations: string[] = Array.isArray(data?.citations)
      ? data.citations.filter((c: unknown): c is string => typeof c === 'string').slice(0, 5)
      : [];
    const result: CachedPerplexityResult = { ok: true, answer, citations, cached: false };

    // Cache write (best-effort)
    if (supabase && answer) {
      try {
        await supabase.from('search_cache').upsert(
          {
            normalized_query: cacheKey,
            source: opts.source,
            results: { answer, citations },
            params: { prompt: opts.prompt.slice(0, 500) },
            ttl_minutes: opts.ttlMinutes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'normalized_query,source' },
        );
      } catch {
        // Cache write failure does not break the response.
      }
    }
    return result;
  } catch (err) {
    return {
      ok: false,
      answer: '',
      citations: [],
      cached: false,
      error: err instanceof Error ? err.message : 'perplexity failed',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}