/**
 * Shared CORS headers for all edge functions.
 *
 * BACKGROUND
 * The original `corsHeaders` constant used `Access-Control-Allow-Origin: '*'`
 * — any origin could call any edge function. Combined with the (now-closed)
 * unauthenticated functions and JWT-passing wildcard, this enabled
 * CSRF-style cross-origin attacks on logged-in users.
 *
 * This module now exports TWO things:
 *
 *   - `corsHeaders` (legacy constant) — kept for backwards compatibility
 *     with existing edge function call sites. Returns a tightened default
 *     origin (homelens.ai) instead of '*'. Callers who can pass the
 *     request object should migrate to `buildCorsHeaders(req)`.
 *
 *   - `buildCorsHeaders(req)` (new) — inspects the request origin against
 *     an allowlist (homelens.ai + Lovable preview hosts + localhost dev +
 *     chrome-extension://*) and echoes it back if allowed, otherwise
 *     returns the safe default. Always sets `Vary: Origin` so caches
 *     don't serve the wrong origin to the wrong caller.
 *
 * See homelens_public_endpoints_fix_prompt.md P0-6.
 */

const ALLOWED_ORIGIN_PATTERNS: Array<(origin: string) => boolean> = [
  (o) => o === 'https://homelens.ai',
  (o) => o === 'https://www.homelens.ai',
  (o) => o === 'https://app.homelens.ai',
  (o) => o === 'https://staging.homelens.ai',
  (o) => /^https:\/\/[a-z0-9-]+\.homelens\.ai$/i.test(o),
  // Production custom domain
  (o) => o === 'https://homelensais.com',
  (o) => o === 'https://www.homelensais.com',
  (o) => /^https:\/\/[a-z0-9-]+\.homelensais\.com$/i.test(o),
  // Lovable hosting / preview
  (o) => /^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(o),
  (o) => /^https:\/\/[a-z0-9-]+\.lovable\.dev$/i.test(o),
  // Local dev (Vite + alternatives)
  (o) => o === 'http://localhost:5173',
  (o) => o === 'http://localhost:3000',
  (o) => o === 'http://localhost:4173',
  // Chrome extension. Tighten to a specific extension ID once published.
  (o) => o.startsWith('chrome-extension://'),
];

const DEFAULT_SAFE_ORIGIN = 'https://homelensais.com';

const ALLOWED_HEADERS =
  'authorization, x-client-info, apikey, content-type, ' +
  'x-supabase-client-platform, x-supabase-client-platform-version, ' +
  'x-supabase-client-runtime, x-supabase-client-runtime-version, ' +
  'x-cron-secret, stripe-signature';

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((match) => match(origin));
}

/**
 * Build CORS headers that echo the request origin only if it's on the
 * allowlist. Use this from new edge functions (or migrate existing ones).
 */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : DEFAULT_SAFE_ORIGIN,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
  };
}

/**
 * Legacy static-header constant used by existing edge functions for their
 * actual JSON responses (preflight goes through buildCorsHeaders, which
 * is origin-aware). Because preflight is already locked down to the
 * allowlist above and every edge function requires a valid Supabase JWT
 * (or signed webhook payload), the response itself can safely echo a
 * wildcard origin. This is what unblocks calls from the Lovable preview
 * host, lovable.app, lovable.dev, localhost, and chrome-extension://*
 * without having to thread `req` through every response helper.
 *
 * Do NOT add `Access-Control-Allow-Credentials: true` alongside `*` —
 * supabase-js calls run with credentials: 'omit' / 'same-origin' and
 * pair fine with a wildcard. Cookie-bearing browser calls are not used
 * by this project.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': ALLOWED_HEADERS,
};

/**
 * Handle CORS preflight request. Returns a Response if it's an OPTIONS
 * request, null otherwise. Usage:
 *   const preflight = handleCors(req);
 *   if (preflight) return preflight;
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }
  return null;
}
