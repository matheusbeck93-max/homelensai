/**
 * milestone-detector
 *
 * Cron-invoked. Iterates active users (signed in within the last 30 days),
 * runs the milestone detector for each, inserts new `delivered_milestones`
 * rows, and enqueues `milestone-celebration` emails for severity=major
 * (and notable for property/market).
 *
 * Auth: X-Cron-Secret via `requireCronAuth`.
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';
import { detectAndPersist } from '../_shared/milestones/detector.ts';
import { sendTransactional } from '../_shared/email/sender.ts';
import { isPausedAndLog, logCronRun } from '../_shared/cron-log.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const startedAt = Date.now();
  if (await isPausedAndLog('milestone-detector-daily', req, startedAt)) {
    return new Response(JSON.stringify({ skipped: 'PRELAUNCH_PAUSE_BACKGROUND_JOBS' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const sinceIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: users, error } = await sb
    .from('profiles')
    .select('id, updated_at')
    .gte('updated_at', sinceIso)
    .limit(2000);
  if (error) {
    console.error('[milestone-detector] profile fetch failed', error);
    await logCronRun({ jobName: 'milestone-detector-daily', startedAt, status: 'error', errorMessage: 'profile_fetch_failed', req });
    return new Response(JSON.stringify({ error: 'profile_fetch_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let totalInserted = 0;
  let emailsQueued = 0;

  for (const u of users ?? []) {
    try {
      const { events, inserted } = await detectAndPersist(u.id);
      totalInserted += inserted;
      for (const ev of events) {
        const shouldEmail =
          ev.severity === 'major' ||
          (ev.severity === 'notable' && (ev.category === 'property' || ev.category === 'market'));
        if (!shouldEmail) continue;
        const outcome = await sendTransactional({
          userId: u.id,
          template: 'milestone-celebration',
          templateData: {
            headline: ev.headline,
            context: ev.context,
            category: ev.category,
            ctaUrl:
              ev.category === 'property'
                ? 'https://homelensais.com/investor/properties'
                : 'https://homelensais.com/',
          },
          idempotencyKey: `${ev.milestoneId}:${ev.subjectId}`,
          metadata: { milestoneId: ev.milestoneId, subjectId: ev.subjectId },
        });
        if (outcome.status === 'sent') {
          emailsQueued += 1;
          await sb
            .from('delivered_milestones')
            .update({ delivered_via_email: true })
            .eq('user_id', u.id)
            .eq('milestone_id', ev.milestoneId)
            .eq('subject_id', ev.subjectId);
        }
      }
    } catch (err) {
      console.error(`[milestone-detector] user ${u.id} failed`, err);
    }
  }

  await logCronRun({
    jobName: 'milestone-detector-daily',
    startedAt,
    status: 'ok',
    metadata: { processed_users: users?.length ?? 0, inserted: totalInserted, emails_sent: emailsQueued },
    req,
  });

  return new Response(
    JSON.stringify({
      processed_users: users?.length ?? 0,
      inserted: totalInserted,
      emails_sent: emailsQueued,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
})(req)));