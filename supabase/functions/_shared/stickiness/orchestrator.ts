/**
 * Cross-feature stickiness orchestrator.
 *
 * Single entry point invoked from various edge functions when a stickiness-
 * relevant event happens. Currently routes:
 *   - streak.tier_crossed → write a `delivered_milestones` row (so banner/share
 *     flow renders the streak badge) + enqueue `streak-milestone` email.
 *
 * Other event types (chat session summarized, saved property added, milestone
 * detected) are no-ops here today — the dedicated edge functions handle them
 * directly. This module exists so we have a single seam to extend without
 * touching every caller.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendTransactional } from '../email/sender.ts';
import { applyStreakReward } from '../streaks/tierRewards.ts';
import type { StreakTier } from '../streaks/engagement.ts';

export type StickinessEvent =
  | {
      type: 'streak.tier_crossed';
      userId: string;
      tier: StreakTier;
      dailyCurrent: number;
    }
  | { type: 'milestone.detected'; userId: string }
  | { type: 'memory.session_summarized'; userId: string }
  | { type: 'saved_property.added'; userId: string; propertyId: string };

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

export async function routeStickinessEvent(event: StickinessEvent): Promise<void> {
  if (event.type !== 'streak.tier_crossed') return;

  const sb = adminClient();
  const reward = await applyStreakReward(event.userId, event.tier);

  const headline = `${event.tier}-day streak unlocked`;
  const context = reward
    ? `${event.dailyCurrent} days in a row. ${reward.detail}`
    : `${event.dailyCurrent} days in a row on HomeLens. Keep going.`;
  const milestoneId = `streak.${event.tier}d`;
  const severity = event.tier >= 30 ? 'major' : event.tier >= 7 ? 'notable' : 'minor';

  await sb.from('delivered_milestones').upsert(
    {
      user_id: event.userId,
      milestone_id: milestoneId,
      subject_id: '',
      category: 'streak',
      severity,
      headline,
      context,
      metadata: { tier: event.tier, reward: reward?.label ?? null },
      delivered_in_app: true,
    },
    { onConflict: 'user_id,milestone_id,subject_id', ignoreDuplicates: true },
  );

  if (severity !== 'minor') {
    await sendTransactional({
      userId: event.userId,
      template: 'streak-milestone',
      templateData: {
        tier: event.tier,
        headline,
        context,
        rewardLabel: reward?.label ?? null,
      },
      idempotencyKey: `${milestoneId}`,
      metadata: { tier: event.tier },
    });
  }
}