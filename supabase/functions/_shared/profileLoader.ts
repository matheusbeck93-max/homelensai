import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/**
 * Per-request memoized profile loader.
 *
 * Edge functions are stateless across invocations, so a WeakMap keyed on the
 * Request object scopes the cache to a single request — multiple call sites
 * inside one handler share one Supabase round-trip instead of N.
 *
 * Returns `{ user, profile }` once the auth header is resolved. Both can be
 * null when the request is anonymous or the token is invalid.
 */

export interface LoadedProfile {
  user: { id: string; email?: string } | null;
  profile: any | null;
}

const cache = new WeakMap<Request, Promise<LoadedProfile>>();

/**
 * Resolve the authenticated user + their `profiles` row.
 * Memoized per `req` — safe to call from multiple code paths inside the same
 * handler without paying for repeated `auth.getUser` + `profiles.select`.
 */
export function loadProfile(req: Request): Promise<LoadedProfile> {
  const cached = cache.get(req);
  if (cached) return cached;

  const promise = (async (): Promise<LoadedProfile> => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return { user: null, profile: null };

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return { user: null, profile: null };

    try {
      const supabase = createClient(supabaseUrl, serviceKey);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return { user: null, profile: null };

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return { user: { id: user.id, email: user.email }, profile: profile ?? null };
    } catch (err) {
      console.error('[profileLoader] Error:', err);
      return { user: null, profile: null };
    }
  })();

  cache.set(req, promise);
  return promise;
}
