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

/**
 * Stickiness-layer hook. Phase 1 surfaces pending milestones and exposes
 * `acknowledge` / `share`. Later phases extend this with `streak` and
 * `weeklyReview` without changing the call-site contract.
 */
export function useStickiness() {
  const [pendingMilestones, setPendingMilestones] = useState<PendingMilestone[]>([]);
  const [loading, setLoading] = useState(true);

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

  return { pendingMilestones, loading, acknowledge, share, refresh };
}