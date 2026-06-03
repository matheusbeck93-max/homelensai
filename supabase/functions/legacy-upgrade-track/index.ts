import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';

const log = createLogger('legacy-upgrade-track');

type Action = 'shown' | 'dismissed' | 'later' | 'no_thanks';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header provided');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error('Not authenticated');

    const body = await req.json().catch(() => ({} as any));
    const action = body?.action as Action;
    const surface: string = body?.surface ?? 'unknown';
    if (!action || !['shown', 'dismissed', 'later', 'no_thanks'].includes(action)) {
      return errorResponse('Invalid action', 400);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, stripe_price_id')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile?.stripe_price_id) {
      return errorResponse('No legacy subscription found', 400);
    }

    const now = new Date();
    const row: Record<string, unknown> = {
      user_id: user.id,
      legacy_price_id: profile.stripe_price_id,
      current_tier: profile.subscription_status,
      surface,
      shown_at: now.toISOString(),
    };
    if (action === 'dismissed') row.dismissed_at = now.toISOString();
    if (action === 'no_thanks') {
      row.dismissed_at = now.toISOString();
      row.deferred_until = new Date(now.getTime() + 90 * 86400_000).toISOString();
    }
    if (action === 'later') {
      row.deferred_until = new Date(now.getTime() + 30 * 86400_000).toISOString();
    }

    const { error } = await supabase.from('legacy_upgrade_nudges').insert(row);
    if (error) throw error;

    log.step('Nudge event recorded', { action, surface });
    return jsonResponse({ ok: true });
  } catch (err) {
    log.error('legacy-upgrade-track failed', err);
    return errorResponse(getErrorMessage(err), 500);
  }
});