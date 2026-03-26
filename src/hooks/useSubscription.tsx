import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SubscriptionTier } from "@/lib/subscriptionPlans";
import { hasFeatureAccess, type FeatureKey } from "@/lib/subscriptionPlans";

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
let lastCheckTime = 0;
let cachedTier: SubscriptionTier | null = null;

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
        cachedTier = null;
        lastCheckTime = 0;
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
        setTier((data.subscription_status as SubscriptionTier) || 'free');
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

    // Use cached result if available and fresh
    const now = Date.now();
    if (cachedTier && (now - lastCheckTime) < CACHE_DURATION) {
      
      setTier(cachedTier);
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
        const newTier = data.tier as SubscriptionTier;
        
        setTier(newTier);
        cachedTier = newTier;
        lastCheckTime = now;
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
