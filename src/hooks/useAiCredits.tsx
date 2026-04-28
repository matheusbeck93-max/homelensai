import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";

export const DAILY_FREE_CREDITS = 100;
const LOW_BALANCE_THRESHOLD = 0.2; // 20%
const LOW_BALANCE_TOAST_KEY = "ai_credits_low_toast_date";

export interface AiCreditsState {
  loading: boolean;
  used: number;
  remaining: number;
  total: number;
  isUnlimited: boolean;
  refresh: () => Promise<void>;
}

/**
 * Tracks the user's AI credit balance for the day.
 * - Premium users: isUnlimited = true, no counters.
 * - Free users: read profiles.ai_credits_used_today / ai_credits_last_reset.
 * - Fires a one-time-per-day toast when remaining drops to ≤20%.
 */
export function useAiCredits(): AiCreditsState {
  const { tier, isPremium } = useSubscription();
  const { toast } = useToast();
  const [used, setUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (isPremium) {
      setUsed(0);
      setLoading(false);
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUsed(0);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("ai_credits_used_today, ai_credits_last_reset")
        .eq("id", user.id)
        .maybeSingle();

      const today = new Date().toISOString().split("T")[0];
      const profile = data as any;
      const sameDay = profile?.ai_credits_last_reset === today;
      const u = sameDay ? (profile?.ai_credits_used_today ?? 0) : 0;
      setUsed(u);

      const remaining = Math.max(0, DAILY_FREE_CREDITS - u);
      const ratio = remaining / DAILY_FREE_CREDITS;
      if (ratio > 0 && ratio <= LOW_BALANCE_THRESHOLD) {
        const lastShown = localStorage.getItem(LOW_BALANCE_TOAST_KEY);
        if (lastShown !== today) {
          localStorage.setItem(LOW_BALANCE_TOAST_KEY, today);
          toast({
            title: "You're running low on AI Credits",
            description: `${remaining} of ${DAILY_FREE_CREDITS} credits left today. Upgrade for unlimited access.`,
          });
        }
      }
    } catch (err) {
      console.error("[useAiCredits] load error", err);
    } finally {
      setLoading(false);
    }
  }, [isPremium, toast]);

  useEffect(() => {
    load();
  }, [load, tier]);

  const remaining = Math.max(0, DAILY_FREE_CREDITS - used);

  return {
    loading,
    used,
    remaining,
    total: DAILY_FREE_CREDITS,
    isUnlimited: isPremium,
    refresh: load,
  };
}