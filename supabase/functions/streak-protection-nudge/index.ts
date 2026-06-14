/**
 * streak-protection-nudge
 *
 * Cron-invoked. Finds users whose current streak is at least 3 days, who
 * have NOT engaged today (in their local timezone), and who still have a
 * weekly skip available. Enqueues the `streak-protection-nudge` email
 * (which itself respects feature flags + suppression via sendTransactional).
 *
 * Quiet-hours and TZ handling: we compute "today" using each user's
 * `profiles.timezone` (default America/New_York). The cron fires hourly
 * and we only nudge users whose local time is between 18:00 and 21:00.
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';
import { sendTransactional } from '../_shared/email/sender.ts';

function localParts(tz: string, now: Date): { hour: number; ymd: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = Number(get('hour'));
  return { hour, ymd };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data: candidates, error } = await sb
    .from('user_engagement_streaks')
    .select('user_id, daily_current, weekly_skip_used, last_engagement_date')
    .gte('daily_current', 3)
    .limit(5000);

  if (error) {
    console.error('[streak-protection-nudge] candidate query failed', error);
    return new Response(JSON.stringify({ error: 'query_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const now = new Date();
  let sent = 0;
  let considered = 0;

  const userIds = (candidates ?? []).map((r: any) => r.user_id);
  const profilesById = new Map<string, { tz: string; disabled: boolean }>();
  if (userIds.length > 0) {
    const { data: profs } = await sb
      .from('profiles')
      .select('id, timezone, streak_tracking_disabled')
      .in('id', userIds);
    for (const p of profs ?? []) {
      profilesById.set(p.id as string, {
        tz: (p as any).timezone || 'America/New_York',
        disabled: !!(p as any).streak_tracking_disabled,
      });
    }
  }

  for (const row of (candidates ?? []) as any[]) {
    const prof = profilesById.get(row.user_id);
    if (!prof || prof.disabled) continue;
    const tz = prof.tz;
    const { hour, ymd } = localParts(tz, now);
    if (hour < 18 || hour > 20) continue;
    if (row.last_engagement_date === ymd) continue;
    considered += 1;

    const outcome = await sendTransactional({
      userId: row.user_id,
      template: 'streak-protection-nudge',
      templateData: {
        dailyCurrent: row.daily_current,
        skipAvailable: !row.weekly_skip_used,
      },
      idempotencyKey: `${ymd}:streak-nudge`,
      metadata: { tz, dailyCurrent: row.daily_current },
    });
    if (outcome.status === 'sent') sent += 1;
  }

  return new Response(
    JSON.stringify({ considered, sent, total_candidates: candidates?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});