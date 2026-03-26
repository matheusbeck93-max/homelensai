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
