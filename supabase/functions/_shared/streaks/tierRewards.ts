/**
 * Streak milestone rewards. Tier × milestone matrix from the plan.
 *   Free:     30-day  → 1 sample Investor Brief flag on profile
 *   Buyer:    90-day  → +$5 AI credits via ai_credit_ledger
 *   Investor: 180-day → loyal_user badge flag on profile
 *
 * Returns a short human-readable reward description so the celebration
 * banner/email can surface what the user just earned. Quiet no-op for
 * combinations not in the matrix.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import type { StreakTier } from './engagement.ts';

type Tier = 'free' | 'buyer' | 'investor';

function normalizeTier(raw: unknown): Tier {
  if (raw === 'free' || raw === 'buyer' || raw === 'investor') return raw;
  if (raw === 'premium') return 'investor';
  if (raw === 'paid') return 'buyer';
  return 'free';
}

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

export interface AppliedReward {
  label: string;
  detail: string;
}

export async function applyStreakReward(
  userId: string,
  tier: StreakTier,
): Promise<AppliedReward | null> {
  const sb = adminClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('subscription_status, plan_credits_remaining_usd')
    .eq('id', userId)
    .maybeSingle();
  const subTier = normalizeTier(profile?.subscription_status);

  if (subTier === 'free' && tier === 30) {
    // No persistent flag column today — the milestone row itself records the
    // unlock in `delivered_milestones.metadata.reward`. UI can read from there.
    return {
      label: 'Sample Investor Brief unlocked',
      detail: '30 days of consistency earned you one free Investor Brief — try the paid experience on us.',
    };
  }

  if (subTier === 'buyer' && tier === 90) {
    const current = Number(profile?.plan_credits_remaining_usd ?? 0);
    await sb
      .from('profiles')
      .update({ plan_credits_remaining_usd: current + 5 })
      .eq('id', userId);
    return {
      label: '+$5 AI credits',
      detail: '90 days running. We added $5 of AI credits to your balance.',
    };
  }

  if (subTier === 'investor' && tier === 180) {
    // Loyal-user badge is surfaced via delivered_milestones.metadata.reward;
    // no dedicated profile column yet.
    return {
      label: 'Loyal user badge',
      detail: '180 days of using HomeLens to make better decisions. Badge earned.',
    };
  }

  return null;
}