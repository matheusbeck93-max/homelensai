import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SubscriptionTier } from "@/lib/subscriptionPlans";
import { hasFeatureAccess, type FeatureKey } from "@/lib/subscriptionPlans";

export function useSubscription() {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

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
      }
    });

    return () => {
      subscription.unsubscribe();
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

  const hasAccess = (feature: FeatureKey): boolean => {
    return hasFeatureAccess(tier, feature);
  };

  const isPro = tier === 'pro';
  const isPremium = tier === 'premium';
  const isProOrPremium = isPro || isPremium;
  const isFree = tier === 'free';

  return {
    tier,
    userId,
    loading,
    hasAccess,
    isPro,
    isPremium,
    isProOrPremium,
    isFree,
    refresh: loadSubscription
  };
}
