import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getSupabaseEnv } from './env.ts';

/**
 * Get the authenticated user from the Authorization header.
 * Returns null if not authenticated or token is invalid.
 */
export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const { url, serviceRoleKey } = getSupabaseEnv();
  const supabase = createClient(url, serviceRoleKey);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

/**
 * Get the authenticated user's profile from the profiles table.
 * Returns { user, profile } or null if not authenticated.
 */
export async function getAuthenticatedUserProfile(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const { url, serviceRoleKey } = getSupabaseEnv();
  const supabase = createClient(url, serviceRoleKey);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile };
}
