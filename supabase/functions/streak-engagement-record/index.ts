/**
 * streak-engagement-record
 *
 * POST { action } — called from the frontend on key engagement actions
 * (app_open, chat_send, analysis_run, artifact_generated, brief_opened,
 * property_saved, calculator_used). Returns the updated streak summary
 * plus the newly-crossed milestone tier when one was hit.
 *
 * When a tier is crossed, hands off to the stickiness orchestrator which
 * applies the tier reward, writes a `delivered_milestones` row, and
 * enqueues the `streak-milestone` email.
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.23.8';
import { corsHeaders } from '../_shared/cors.ts';
import { recordEngagement, type EngagementAction } from '../_shared/streaks/engagement.ts';
import { routeStickinessEvent } from '../_shared/stickiness/orchestrator.ts';

const BodySchema = z.object({
  action: z.enum([
    'app_open',
    'chat_send',
    'analysis_run',
    'artifact_generated',
    'brief_opened',
    'property_saved',
    'calculator_used',
  ]),
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'invalid_body' }, 400);

  try {
    const result = await recordEngagement(
      userData.user.id,
      parsed.data.action as EngagementAction,
    );
    if (result.crossed_tier) {
      // Fire-and-forget: do not block the response on email send.
      routeStickinessEvent({
        type: 'streak.tier_crossed',
        userId: userData.user.id,
        tier: result.crossed_tier,
        dailyCurrent: result.daily_current,
      }).catch((e) => console.error('[streak-engagement-record] orchestrator failed', e));
    }
    return json(result);
  } catch (err) {
    console.error('[streak-engagement-record] failed', err);
    return json({ error: 'internal' }, 500);
  }
});