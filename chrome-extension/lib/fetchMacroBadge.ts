/**
 * Fetch wrapper for the `extension-macro-badge` edge function.
 * Caches per metro in chrome.storage.session (TTL 30 min) so reopening
 * the popup on the same tab is free.
 */

const SUPABASE_URL = 'https://yckcdxtatwolzilboahx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2NkeHRhdHdvbHppbGJvYWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDk3MTEsImV4cCI6MjA3Njg4NTcxMX0.MyOrW96L1QrSXoHaeU-XcR35-YEeqxKLxxc2pZJYww4';

const TTL_MS = 30 * 60 * 1000; // 30 min

export interface MacroBadgeData {
  ok: true;
  metro: string;
  labor: {
    unemployment_pct: number | null;
    labor_force: number | null;
    as_of: string | null;
  } | null;
  wage: {
    wage_yoy_pct: number | null;
    home_price_yoy_pct: number | null;
    wage_vs_price_gap_pp: number | null;
    verdict: string | null;
  } | null;
  hpi: {
    case_shiller_index: number | null;
    yoy_pct: number | null;
    as_of: string | null;
    fallback_to_national: boolean;
  } | null;
  rate: {
    rate_30y_pct: number | null;
    change_30d_bps: number | null;
    as_of: string | null;
  } | null;
  generated_at: string;
  source: string;
}

interface CacheEntry {
  fetchedAt: number;
  data: MacroBadgeData;
}

function cacheKey(city: string, state: string): string {
  return `hl_macro_badge::${city.toLowerCase()}|${state.toLowerCase()}`;
}

async function readCache(key: string): Promise<CacheEntry | null> {
  try {
    const session = (chrome as any)?.storage?.session;
    if (!session) return null;
    const result = await session.get(key);
    const entry = result?.[key] as CacheEntry | undefined;
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(key: string, data: MacroBadgeData): Promise<void> {
  try {
    const session = (chrome as any)?.storage?.session;
    if (!session) return;
    await session.set({ [key]: { fetchedAt: Date.now(), data } });
  } catch {
    /* ignore */
  }
}

export async function fetchMacroBadge(
  city: string,
  state: string,
  authHeader: string,
): Promise<{ ok: true; data: MacroBadgeData; cachedAt: number } | { ok: false; error: string }> {
  const key = cacheKey(city, state);
  const cached = await readCache(key);
  if (cached) {
    return { ok: true, data: cached.data, cachedAt: cached.fetchedAt };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/extension-macro-badge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
      },
      body: JSON.stringify({ city, state }),
    });
    if (!res.ok) {
      return { ok: false, error: `http_${res.status}` };
    }
    const data = (await res.json()) as MacroBadgeData;
    if (!data?.ok) return { ok: false, error: 'invalid_payload' };
    await writeCache(key, data);
    return { ok: true, data, cachedAt: Date.now() };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'network_error' };
  }
}