/**
 * Handles unsubscribe link clicks from transactional email footers.
 *
 *   GET  /handle-email-unsubscribe?token=XXX  -> { valid, alreadyUsed }
 *   POST /handle-email-unsubscribe { token }  -> consumes the token,
 *                                                marks the user as
 *                                                unsubscribed, adds the
 *                                                recipient to the
 *                                                suppression list.
 *
 * Public endpoint (no auth) — token is the bearer of intent. Tokens are
 * single-use; consumed tokens return `alreadyUsed: true` for idempotent UX.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';
import { z } from 'https://esm.sh/zod@3.23.8';

const PostSchema = z.object({ token: z.string().min(8).max(128) });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) return json({ valid: false, error: 'missing token' }, 400);
    const { data } = await supabase
      .from('email_unsubscribe_tokens')
      .select('user_id, consumed_at')
      .eq('token', token)
      .maybeSingle();
    if (!data) return json({ valid: false, alreadyUsed: false });
    return json({ valid: true, alreadyUsed: !!data.consumed_at });
  }

  if (req.method === 'POST') {
    let body: { token?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const token = parsed.data.token;

    const { data: row, error: rowErr } = await supabase
      .from('email_unsubscribe_tokens')
      .select('user_id, consumed_at')
      .eq('token', token)
      .maybeSingle();
    if (rowErr || !row) return json({ error: 'invalid token' }, 404);
    if (row.consumed_at) return json({ ok: true, alreadyUsed: true });

    // Mark token consumed.
    await supabase
      .from('email_unsubscribe_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('token', token);

    // Flip preferences.
    await supabase
      .from('email_preferences')
      .upsert(
        { user_id: row.user_id, unsubscribed_at: new Date().toISOString(), enabled: false },
        { onConflict: 'user_id' },
      );

    // Add the user's primary email to the suppression list.
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', row.user_id)
      .maybeSingle();
    if (profile?.email) {
      await supabase
        .from('email_suppression')
        .upsert(
          { email: String(profile.email).toLowerCase(), reason: 'unsubscribe' },
          { onConflict: 'email' },
        );
    }

    return json({ ok: true, alreadyUsed: false });
  }

  return json({ error: 'method not allowed' }, 405);
});