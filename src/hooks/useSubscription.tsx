import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SubscriptionTier } from "@/lib/subscriptionPlans";
import { hasFeatureAccess, type FeatureKey } from "@/lib/subscriptionPlans";


const VALID_TIERS: ReadonlySet<SubscriptionTier> = new Set(['free', 'premium']);

/**
 * Validate that a value read from profiles.subscription_status is one of the
 * known tiers. If not (typo, stale value, future product mismatch), fall back
 * to 'free' rather than coercing through TypeScript's erased types into an
 * undefined-behavior tier. See homelens_subscription_billing_fix_prompt.md P1-3.
 */
function validateTier(raw: unknown): SubscriptionTier {
  if (typeof raw === 'string' && VALID_TIERS.has(raw as SubscriptionTier)) {
    return raw as SubscriptionTier;
  }
  return 'free';
}

// Cache duration: 60 seconds (tightened from 5 minutes).
// Per-user keyed cache prevents leaks across sign-out/sign-in cycles on the
// same tab. See homelens_subscription_billing_fix_prompt.md P1-4.
const CACHE_DURATION = 60 * 1000;
const cachedTierByUser = new Map<string, { tier: SubscriptionTier; timestamp: number }>();

export function useSubscription() {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const checkInProgress = useRef(false);

  useEffect(() => {
    loadSubscription();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadSubscription();
      } else {
        setTier('free');
        setUserId(null);
        setLoading(false);
        cachedTierByUser.clear();
      }
    });

    // Auto-refresh subscription every 5 minutes (reduced from 60 seconds)
    const interval = setInterval(() => {
      const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          checkStripeSubscription();
        }
      };
      checkAuth();
    }, 5 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const loadSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setTier('free');
        setUserId(null);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading subscription:', error);
        setTier('free');
      } else if (data) {
        setTier(validateTier(data.subscription_status));
      } else {
        setTier('free');
      }
    } catch (error) {
      console.error('Error in loadSubscription:', error);
      setTier('free');
    } finally {
      setLoading(false);
    }
  };

  const checkStripeSubscription = async () => {
    // Prevent concurrent checks
    if (checkInProgress.current) {
      
      return;
    }

    // Use per-user cached result if available and fresh
    const now = Date.now();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      checkInProgress.current = false;
      return;
    }
    const cached = cachedTierByUser.get(currentUser.id);
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      setTier(cached.tier);
      checkInProgress.current = false;
      return;
    }

    checkInProgress.current = true;
    
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking Stripe subscription:', error);
        return;
      }

      if (data?.tier) {
        const newTier = validateTier(data.tier);
        setTier(newTier);
        cachedTierByUser.set(currentUser.id, { tier: newTier, timestamp: now });
      }
    } catch (error) {
      console.error('Error in checkStripeSubscription:', error);
    } finally {
      checkInProgress.current = false;
    }
  };

  const hasAccess = (feature: FeatureKey): boolean => {
    return hasFeatureAccess(tier, feature);
  };

  const isPremiumUser = tier === 'premium';
  const isFreeUser = tier === 'free';

  return {
    tier,
    userId,
    loading,
    hasAccess,
    isPremium: isPremiumUser,
    isFree: isFreeUser,
    refresh: loadSubscription
  };
}
