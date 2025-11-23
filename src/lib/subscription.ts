import { supabase } from "@/integrations/supabase/client";
import type { SubscriptionTier } from "./subscriptionPlans";

export interface UserSubscription {
  subscription_status: SubscriptionTier;
  subscription_renews_at?: string | null;
  subscription_cancel_at?: string | null;
  daily_analysis_count: number;
  daily_analysis_last_reset: string;
}

const DAILY_ANALYSIS_LIMIT_FREE = 3;

/**
 * Get the user's current subscription data
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_renews_at, subscription_cancel_at, daily_analysis_count, daily_analysis_last_reset')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching subscription:', error);
    return null;
  }

  return data as UserSubscription;
}

/**
 * Check if user can run an AI analysis based on their tier and daily limit
 */
export async function canRunAnalysis(userId: string): Promise<{ canRun: boolean; reason?: string; remaining?: number }> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return { canRun: false, reason: 'Unable to fetch subscription data' };
  }

  // Pro and Premium have unlimited analyses
  if (subscription.subscription_status === 'pro' || subscription.subscription_status === 'premium') {
    return { canRun: true };
  }

  // Free tier: check daily limit
  await resetDailyAnalysisIfNeeded(userId, subscription);
  
  // Refetch after potential reset
  const updatedSubscription = await getUserSubscription(userId);
  if (!updatedSubscription) {
    return { canRun: false, reason: 'Unable to fetch subscription data' };
  }

  const remaining = DAILY_ANALYSIS_LIMIT_FREE - updatedSubscription.daily_analysis_count;
  
  if (updatedSubscription.daily_analysis_count >= DAILY_ANALYSIS_LIMIT_FREE) {
    return { 
      canRun: false, 
      reason: `Daily limit reached (${DAILY_ANALYSIS_LIMIT_FREE} analyses per day on Free tier)`,
      remaining: 0
    };
  }

  return { canRun: true, remaining };
}

/**
 * Increment the daily analysis count for a user
 */
export async function incrementDailyAnalysisCount(userId: string): Promise<void> {
  const subscription = await getUserSubscription(userId);
  if (subscription) {
    await supabase
      .from('profiles')
      .update({ daily_analysis_count: subscription.daily_analysis_count + 1 })
      .eq('id', userId);
  }
}

/**
 * Reset daily analysis count if it's a new day
 */
export async function resetDailyAnalysisIfNeeded(userId: string, subscription?: UserSubscription): Promise<void> {
  if (!subscription) {
    subscription = await getUserSubscription(userId);
  }
  
  if (!subscription) return;

  const today = new Date().toISOString().split('T')[0];
  const lastReset = subscription.daily_analysis_last_reset?.split('T')[0];

  if (lastReset !== today) {
    await supabase
      .from('profiles')
      .update({
        daily_analysis_count: 0,
        daily_analysis_last_reset: new Date().toISOString()
      })
      .eq('id', userId);
  }
}

/**
 * Update user's subscription status (for development/testing or after successful payment)
 */
export async function updateSubscriptionStatus(
  userId: string, 
  status: SubscriptionTier,
  renewsAt?: Date | null,
  cancelAt?: Date | null
): Promise<void> {
  const updates: any = {
    subscription_status: status
  };

  if (renewsAt !== undefined) {
    updates.subscription_renews_at = renewsAt?.toISOString() || null;
  }

  if (cancelAt !== undefined) {
    updates.subscription_cancel_at = cancelAt?.toISOString() || null;
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

/**
 * Get remaining analyses for free tier users
 */
export async function getRemainingAnalyses(userId: string): Promise<number> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) return 0;
  
  if (subscription.subscription_status !== 'free') {
    return -1; // -1 indicates unlimited
  }

  await resetDailyAnalysisIfNeeded(userId, subscription);
  
  const updatedSubscription = await getUserSubscription(userId);
  if (!updatedSubscription) return 0;

  return Math.max(0, DAILY_ANALYSIS_LIMIT_FREE - updatedSubscription.daily_analysis_count);
}
