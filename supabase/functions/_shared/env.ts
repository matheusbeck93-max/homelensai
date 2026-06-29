/**
 * Get a required environment variable. Throws if not set.
 */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

/**
 * Get an optional environment variable. Returns undefined if not set.
 */
export function optionalEnv(name: string): string | undefined {
  return Deno.env.get(name);
}

/**
 * Standard Supabase env vars.
 */
export function getSupabaseEnv() {
  return {
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  };
}

/**
 * Detect if request is from preview/staging or local dev environment.
 * Used to isolate dev spend from production credit accounting.
 */
export function isDevCall(req?: Request | null): boolean {
  if (Deno.env.get("DEV_MODE_AI_SKIP_LEDGER") === "1" || Deno.env.get("IS_DEV_ENV") === "true") {
    return true;
  }
  if (!req) return false;
  const origin = req.headers.get("origin") || req.headers.get("referer") || req.headers.get("host") || "";
  return origin.includes("-preview--") || origin.includes("localhost") || origin.includes("127.0.0.1");
}
