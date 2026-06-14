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
    .select('subscription_status')
    .eq('id', userId)
    .maybeSingle();
  const subTier = normalizeTier(profile?.subscription_status);

  if (subTier === 'free' && tier === 30) {
    await sb
      .from('profiles')
      .update({ streak_sample_brief_unlocked: true })
      .eq('id', userId);
    return {
      label: 'Sample Investor Brief unlocked',
      detail: '30 days of consistency earned you one free Investor Brief — try the paid experience on us.',
    };
  }

  if (subTier === 'buyer' && tier === 90) {
    await sb.from('ai_credit_ledger').insert({
      user_id: userId,
      amount_usd: 5,
      reason: 'streak_reward_90d',
      metadata: { tier: 90 },
    });
    return {
      label: '+$5 AI credits',
      detail: '90 days running. We added $5 of AI credits to your balance.',
    };
  }

  if (subTier === 'investor' && tier === 180) {
    await sb
      .from('profiles')
      .update({ loyal_user: true })
      .eq('id', userId);
    return {
      label: 'Loyal user badge',
      detail: '180 days of using HomeLens to make better decisions. Badge earned.',
    };
  }

  return null;
}