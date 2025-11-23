import { supabase } from "@/integrations/supabase/client";

const DAILY_COMPARISON_LIMIT_FREE = 1;

/**
 * Check if user can run a comparison based on their tier and daily limit
 */
export async function canRunComparison(
  userId: string,
  subscriptionStatus: 'free' | 'pro' | 'premium'
): Promise<{ canRun: boolean; reason?: string; remaining?: number }> {
  // Pro and Premium have unlimited comparisons
  if (subscriptionStatus === 'pro' || subscriptionStatus === 'premium') {
    return { canRun: true };
  }

  // Free tier: check daily limit
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return { canRun: false, reason: 'Unable to fetch subscription data' };
  }

  // Check comparison count from localStorage (per-device limit for free tier)
  const today = new Date().toISOString().split('T')[0];
  const storageKey = `homelens_comparison_count_${userId}`;
  const stored = localStorage.getItem(storageKey);
  
  let comparisonData = { count: 0, date: today };
  
  if (stored) {
    try {
      comparisonData = JSON.parse(stored);
      // Reset if it's a new day
      if (comparisonData.date !== today) {
        comparisonData = { count: 0, date: today };
      }
    } catch (e) {
      comparisonData = { count: 0, date: today };
    }
  }

  const remaining = DAILY_COMPARISON_LIMIT_FREE - comparisonData.count;

  if (comparisonData.count >= DAILY_COMPARISON_LIMIT_FREE) {
    return {
      canRun: false,
      reason: `Daily limit reached (${DAILY_COMPARISON_LIMIT_FREE} comparison per day on Free tier)`,
      remaining: 0,
    };
  }

  return { canRun: true, remaining };
}

/**
 * Increment the daily comparison count for a free user
 */
export function incrementComparisonCount(userId: string): void {
  const today = new Date().toISOString().split('T')[0];
  const storageKey = `homelens_comparison_count_${userId}`;
  const stored = localStorage.getItem(storageKey);

  let comparisonData = { count: 0, date: today };

  if (stored) {
    try {
      comparisonData = JSON.parse(stored);
      if (comparisonData.date !== today) {
        comparisonData = { count: 0, date: today };
      }
    } catch (e) {
      comparisonData = { count: 0, date: today };
    }
  }

  comparisonData.count += 1;
  localStorage.setItem(storageKey, JSON.stringify(comparisonData));
}

/**
 * Get remaining comparisons for free tier users
 */
export function getRemainingComparisons(userId: string): number {
  const today = new Date().toISOString().split('T')[0];
  const storageKey = `homelens_comparison_count_${userId}`;
  const stored = localStorage.getItem(storageKey);

  let comparisonData = { count: 0, date: today };

  if (stored) {
    try {
      comparisonData = JSON.parse(stored);
      if (comparisonData.date !== today) {
        return DAILY_COMPARISON_LIMIT_FREE;
      }
    } catch (e) {
      return DAILY_COMPARISON_LIMIT_FREE;
    }
  }

  return Math.max(0, DAILY_COMPARISON_LIMIT_FREE - comparisonData.count);
}
