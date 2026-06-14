import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MilestoneCategory = 'property' | 'saved' | 'account' | 'market' | 'streak';
export type MilestoneSeverity = 'minor' | 'notable' | 'major';

export interface PendingMilestone {
  id: string;
  milestoneId: string;
  subjectId: string;
  category: MilestoneCategory;
  severity: MilestoneSeverity;
  headline: string;
  context: string | null;
  metadata: Record<string, unknown>;
  detectedAt: string;
}

export interface ShareResult {
  url: string;
  format: 'png' | 'svg';
  tweetText: string;
  expiresInSeconds: number;
}

export interface StreakSummary {
  daily_current: number;
  daily_longest: number;
  weekly_skip_used: boolean;
  last_engagement_date: string | null;
  disabled: boolean;
}

export type EngagementAction =
  | 'app_open'
  | 'chat_send'
  | 'analysis_run'
  | 'artifact_generated'
  | 'brief_opened'
  | 'property_saved'
  | 'calculator_used';

/**
 * Stickiness-layer hook. Phase 1 surfaces pending milestones and exposes
 * `acknowledge` / `share`. Phase 3 adds `streak` and `recordEngagement`.
 */
export function useStickiness() {
  const [pendingMilestones, setPendingMilestones] = useState<PendingMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<StreakSummary | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        setPendingMilestones([]);
        return;
      }
      const { data, error } = await supabase
        .from('delivered_milestones')
        .select('id, milestone_id, subject_id, category, severity, headline, context, metadata, detected_at')
        .is('acknowledged_at', null)
        .order('detected_at', { ascending: false })
        .limit(10);
      if (error) {
        console.error('[useStickiness] load failed', error);
        setPendingMilestones([]);
        return;
      }
      setPendingMilestones(
        (data ?? []).map((r: any) => ({
          id: r.id,
          milestoneId: r.milestone_id,
          subjectId: r.subject_id,
          category: r.category,
          severity: r.severity,
          headline: r.headline,
          context: r.context,
          metadata: r.metadata ?? {},
          detectedAt: r.detected_at,
        })),
      );
      // Load streak in parallel; treat absence as a zero-streak record.
      const [{ data: streakRow }, { data: profileRow }] = await Promise.all([
        supabase
          .from('user_engagement_streaks')
          .select('daily_current, daily_longest, weekly_skip_used, last_engagement_date')
          .eq('user_id', session.session.user.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('streak_tracking_disabled')
          .eq('id', session.session.user.id)
          .maybeSingle(),
      ]);
      setStreak({
        daily_current: streakRow?.daily_current ?? 0,
        daily_longest: streakRow?.daily_longest ?? 0,
        weekly_skip_used: streakRow?.weekly_skip_used ?? false,
        last_engagement_date: streakRow?.last_engagement_date ?? null,
        disabled: !!profileRow?.streak_tracking_disabled,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const acknowledge = useCallback(
    async (id: string) => {
      setPendingMilestones((curr) => curr.filter((m) => m.id !== id));
      await supabase.functions.invoke('milestone-acknowledge', { body: { id } });
    },
    [],
  );

  const share = useCallback(async (id: string): Promise<ShareResult | null> => {
    const { data, error } = await supabase.functions.invoke('milestone-share', { body: { id } });
    if (error || !data) {
      console.error('[useStickiness] share failed', error);
      return null;
    }
    return data as ShareResult;
  }, []);

  const recordEngagement = useCallback(
    async (action: EngagementAction) => {
      const { data, error } = await supabase.functions.invoke('streak-engagement-record', {
        body: { action },
      });
      if (error || !data) return null;
      const next = data as {
        daily_current: number;
        daily_longest: number;
        weekly_skip_used: boolean;
        crossed_tier: number | null;
        disabled: boolean;
      };
      setStreak((curr) => ({
        daily_current: next.daily_current,
        daily_longest: next.daily_longest,
        weekly_skip_used: next.weekly_skip_used,
        last_engagement_date: curr?.last_engagement_date ?? null,
        disabled: next.disabled,
      }));
      if (next.crossed_tier) {
        // Refresh milestones so the celebration banner picks up the new row.
        setTimeout(refresh, 1500);
      }
      return next;
    },
    [refresh],
  );

  return {
    pendingMilestones,
    loading,
    acknowledge,
    share,
    refresh,
    streak,
    recordEngagement,
  };
}