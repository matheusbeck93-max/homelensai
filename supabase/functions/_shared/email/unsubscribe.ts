/**
 * Unsubscribe token helpers. Tokens are opaque random strings stored in
 * `email_unsubscribe_tokens`. One active token per user is reused for
 * footer links; consuming it (POST /handle-email-unsubscribe) marks
 * `consumed_at` and updates preferences.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function ensureUnsubscribeToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('user_id', userId)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) return existing.token as string;

  const token = randomToken();
  await supabase
    .from('email_unsubscribe_tokens')
    .insert({ token, user_id: userId });
  return token;
}

export function buildUnsubscribeUrl(token: string): string {
  const base = Deno.env.get('APP_PUBLIC_URL') ?? 'https://homelensai.com';
  return `${base}/account/email-unsubscribe?token=${encodeURIComponent(token)}`;
}