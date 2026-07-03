import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { createLogger } from '../_shared/logging.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const log = createLogger('gsc-insights');

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_search_console';
const SITE_URL = 'https://homelensais.com/';
const SITE_ENC = encodeURIComponent(SITE_URL);

// In-memory cache (per-instance, ~30 min TTL)
let cache: { at: number; payload: unknown } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

function gwHeaders(): HeadersInit {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GSC_KEY = Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');
  if (!GSC_KEY) throw new Error('GOOGLE_SEARCH_CONSOLE_API_KEY is not configured');
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': GSC_KEY,
    'Content-Type': 'application/json',
  };
}

async function gscFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { ...gwHeaders(), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

function isAuthorized(email: string | null | undefined): boolean {
  const list = (Deno.env.get('GSC_ADMIN_EMAILS') ?? '').toLowerCase();
  if (!list) return false;
  if (!email) return false;
  return list.split(',').map((s) => s.trim()).includes(email.toLowerCase());
}

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Missing authorization header', 401);
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return errorResponse('Unauthorized', 401);
    const user = userData.user;

    if (!isAuthorized(user.email)) {
      return errorResponse('Forbidden — your email is not on GSC_ADMIN_EMAILS allowlist', 403);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'insights';
    const force = url.searchParams.get('refresh') === '1';

    // -------- Verification flow (META method) --------
    if (action === 'verify-token') {
      const r = await gscFetch('/siteVerification/v1/token', {
        method: 'POST',
        body: JSON.stringify({
          site: { identifier: SITE_URL, type: 'SITE' },
          verificationMethod: 'META',
        }),
      });
      return jsonResponse({ ok: r.ok, status: r.status, ...(r.data as object || {}) }, r.ok ? 200 : r.status);
    }

    if (action === 'verify-confirm') {
      const v = await gscFetch('/siteVerification/v1/webResource?verificationMethod=META', {
        method: 'POST',
        body: JSON.stringify({ site: { identifier: SITE_URL, type: 'SITE' } }),
      });
      if (!v.ok) return jsonResponse({ ok: false, status: v.status, error: v.data }, v.status);
      // Add to Search Console once verified
      await gscFetch(`/webmasters/v3/sites/${SITE_ENC}`, { method: 'PUT' });
      // Submit sitemap
      const feed = encodeURIComponent('https://homelensais.com/sitemap.xml');
      await gscFetch(`/webmasters/v3/sites/${SITE_ENC}/sitemaps/${feed}`, { method: 'PUT' });
      cache = null;
      return jsonResponse({ ok: true });
    }

    if (action === 'submit-sitemap') {
      const feed = encodeURIComponent('https://homelensais.com/sitemap.xml');
      const r = await gscFetch(`/webmasters/v3/sites/${SITE_ENC}/sitemaps/${feed}`, { method: 'PUT' });
      cache = null;
      return jsonResponse({ ok: r.ok, status: r.status }, r.ok ? 200 : r.status);
    }

    // -------- Default: insights --------
    if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return jsonResponse({ ...(cache.payload as object), cached: true });
    }

    const end = new Date();
    const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const [sites, sitemaps, queryStats, pageStats, totals] = await Promise.all([
      gscFetch('/webmasters/v3/sites'),
      gscFetch(`/webmasters/v3/sites/${SITE_ENC}/sitemaps`),
      gscFetch(`/webmasters/v3/sites/${SITE_ENC}/searchAnalytics/query`, {
        method: 'POST',
        body: JSON.stringify({
          startDate: fmt(start),
          endDate: fmt(end),
          dimensions: ['query'],
          rowLimit: 10,
        }),
      }),
      gscFetch(`/webmasters/v3/sites/${SITE_ENC}/searchAnalytics/query`, {
        method: 'POST',
        body: JSON.stringify({
          startDate: fmt(start),
          endDate: fmt(end),
          dimensions: ['page'],
          rowLimit: 10,
        }),
      }),
      gscFetch(`/webmasters/v3/sites/${SITE_ENC}/searchAnalytics/query`, {
        method: 'POST',
        body: JSON.stringify({
          startDate: fmt(start),
          endDate: fmt(end),
          dimensions: [],
          rowLimit: 1,
        }),
      }),
    ]);

    const verified = (() => {
      const list = (sites.data as any)?.siteEntry as Array<any> | undefined;
      if (!list) return false;
      return list.some(
        (s) => s.siteUrl === SITE_URL && (s.permissionLevel ?? '').toLowerCase() !== 'siteunverifieduser',
      );
    })();

    const totalsRow = ((totals.data as any)?.rows ?? [])[0] ?? null;

    const payload = {
      site: SITE_URL,
      verified,
      window: { startDate: fmt(start), endDate: fmt(end) },
      sitemaps: (sitemaps.data as any)?.sitemap ?? [],
      sitemapsError: !sitemaps.ok ? sitemaps.data : null,
      topQueries: (queryStats.data as any)?.rows ?? [],
      topPages: (pageStats.data as any)?.rows ?? [],
      totals: totalsRow,
      cached: false,
      fetchedAt: new Date().toISOString(),
    };

    cache = { at: Date.now(), payload };
    return jsonResponse(payload);
  } catch (err) {
    log.error?.('gsc-insights failed', { error: String(err) });
    return errorResponse(err instanceof Error ? err.message : 'Unknown error', 500);
  }
})(req)));
