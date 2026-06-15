import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  OpenHouseFilters,
  OpenHouseSearchResult,
} from '@/types/openHouses';

const CACHE_TTL_MS = 15 * 60 * 1000;

function cacheKey(f: OpenHouseFilters): string {
  return `oh:${f.country}|${(f.state ?? '').toLowerCase()}|${(f.city ?? '').toLowerCase()}|${f.dateFrom ?? ''}|${f.dateTo ?? ''}|${f.priceMin ?? ''}|${f.priceMax ?? ''}`;
}

function readLocalCache(key: string): { data: OpenHouseSearchResult; ts: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocalCache(key: string, data: OpenHouseSearchResult) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function useOpenHouseSearch() {
  const [result, setResult] = useState<OpenHouseSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (filters: OpenHouseFilters, opts?: { bypassCache?: boolean }) => {
    setError(null);
    setLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const key = cacheKey(filters);
    const local = opts?.bypassCache ? null : readLocalCache(key);
    if (local && !opts?.bypassCache) {
      setResult(local.data);
      // stale-while-revalidate
      if (Date.now() - local.ts < CACHE_TTL_MS) {
        setLoading(false);
        return local.data;
      }
    }

    try {
      // Strip null/undefined keys — the edge function's Zod schema treats
      // these fields as optional but rejects explicit nulls.
      const cleanBody = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== null && v !== undefined && v !== ''),
      );
      if (opts?.bypassCache) (cleanBody as Record<string, unknown>).bypass_cache = true;
      const { data, error } = await supabase.functions.invoke('open-houses-search', {
        body: cleanBody,
      });
      if (error) throw error;
      const typed = data as OpenHouseSearchResult;
      writeLocalCache(key, typed);
      setResult(typed);
      return typed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { result, loading, error, search };
}
