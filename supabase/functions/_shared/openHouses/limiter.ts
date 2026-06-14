/**
 * Free-tier daily-counter enforcement for open-house searches.
 * Buyer and Investor tiers bypass the counter entirely.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireEnv } from '../env.ts';
import type { SubscriptionTier } from '../tierGate.ts';

const FREE_DAILY_LIMIT = 5;

export interface LimitCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  reason?: string;
}

export async function checkAndIncrementOpenHouseQuota(
  userId: string | null,
  tier: SubscriptionTier,
): Promise<LimitCheckResult> {
  if (tier === 'buyer' || tier === 'investor') {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, limit: Number.POSITIVE_INFINITY };
  }

  if (!userId) {
    // Anonymous user — allow but don't track (they hit anon-key auth issues anyway).
    return { allowed: true, remaining: FREE_DAILY_LIMIT, limit: FREE_DAILY_LIMIT };
  }

  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_open_house_searches, daily_open_house_searches_reset_at')
    .eq('id', userId)
    .maybeSingle();

  const now = new Date();
  const resetAt = profile?.daily_open_house_searches_reset_at
    ? new Date(profile.daily_open_house_searches_reset_at as string)
    : null;
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const needsReset = !resetAt || resetAt < startOfToday;
  const currentCount = needsReset ? 0 : ((profile?.daily_open_house_searches as number | null) ?? 0);

  if (currentCount >= FREE_DAILY_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      limit: FREE_DAILY_LIMIT,
      reason: `Free plan limit reached (${FREE_DAILY_LIMIT} open-house searches per day). Upgrade for unlimited.`,
    };
  }

  const nextCount = currentCount + 1;
  await supabase
    .from('profiles')
    .update({
      daily_open_house_searches: nextCount,
      daily_open_house_searches_reset_at: needsReset ? now.toISOString() : (profile?.daily_open_house_searches_reset_at as string),
    })
    .eq('id', userId);

  return {
    allowed: true,
    remaining: FREE_DAILY_LIMIT - nextCount,
    limit: FREE_DAILY_LIMIT,
  };
}

export { FREE_DAILY_LIMIT };
