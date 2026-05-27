import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { composeBriefCards } from '@/lib/investorBrief/briefComposer';
import type {
  ComposedCard,
  ContextSnapshot,
  InsightBullet,
  PersistedBrief,
  PersistedBriefCard,
} from '@/lib/investorBrief/types';

const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface BriefBundle {
  brief: PersistedBrief;
  cards: PersistedBriefCard[];
  context: ContextSnapshot | null;
  /** registry id → composed card for renderer dispatch (rehydrated from data_snapshot). */
  composedById: Record<string, ComposedCard>;
}

function buildComposedFromPersisted(cards: PersistedBriefCard[]): Record<string, ComposedCard> {
  const out: Record<string, ComposedCard> = {};
  for (const c of cards) {
    out[c.id] = {
      id: c.id,
      cardType: c.card_type,
      title: (c.data_snapshot?.title as string) ?? c.card_type,
      subtitle: c.data_snapshot?.subtitle as string | undefined,
      data: c.data_snapshot?.data ?? c.data_snapshot,
      config: c.config,
      summary: (c.data_snapshot?.summary as string) ?? '',
      investigatePrompt:
        (c.data_snapshot?.investigatePrompt as string) ?? 'Tell me more about this card.',
      priority: 0,
      sources: c.data_snapshot?.sources ?? undefined,
      isEstimate: c.data_snapshot?.isEstimate ?? undefined,
    };
  }
  return out;
}

export function useInvestorBrief(userId: string | null) {
  const { toast } = useToast();
  const [bundle, setBundle] = useState<BriefBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const loadLatest = useCallback(async (): Promise<BriefBundle | null> => {
    if (!userId) return null;
    const { data: briefRow } = await supabase
      .from('investor_briefs')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!briefRow) return null;

    const { data: cardRows } = await supabase
      .from('investor_brief_cards')
      .select('*')
      .eq('brief_id', briefRow.id)
      .order('position', { ascending: true });

    const cards = (cardRows ?? []) as PersistedBriefCard[];
    return {
      brief: briefRow as unknown as PersistedBrief,
      cards,
      context: (briefRow as any).context_snapshot ?? null,
      composedById: buildComposedFromPersisted(cards),
    };
  }, [userId]);

  const regenerate = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    if (!userId) return;
    const now = Date.now();
    if (!opts?.force && now - lastRefreshRef.current < REFRESH_COOLDOWN_MS) {
      if (opts?.silent) return;
      const waitSec = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastRefreshRef.current)) / 1000);
      toast({
        title: 'Refresh available soon',
        description: `Please wait ${waitSec}s before refreshing again.`,
      });
      return;
    }
    lastRefreshRef.current = now;
    setRefreshing(true);

    try {
      const { context, cards } = await composeBriefCards(userId);

      if (cards.length === 0) {
        toast({
          title: 'Nothing to brief yet',
          description: 'Save a property or run an analysis first.',
        });
        return;
      }

      const payload = {
        contextSnapshot: {
          preferences: context.preferences,
        },
        selectedCards: cards.map((c) => ({
          type: c.cardType,
          title: c.title,
          config: c.config,
          dataSnapshot: {
            title: c.title,
            subtitle: c.subtitle,
            data: c.data,
            summary: c.summary,
            investigatePrompt: c.investigatePrompt,
            sources: c.sources,
            isEstimate: c.isEstimate,
          },
          summary: c.summary,
        })),
        pinnedTalkingPoints: context.pinnedTalkingPoints.map((tp) => tp.text),
      };

      const { data, error } = await supabase.functions.invoke('investor-brief', {
        body: payload,
      });

      if (error) {
        toast({
          title: 'Brief generation failed',
          description: error.message ?? 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      if (data?.error) {
        toast({
          title: 'Brief generation failed',
          description: String(data.error),
          variant: 'destructive',
        });
        return;
      }

      const fresh = await loadLatest();
      setBundle(fresh);
    } catch (err) {
      console.error('regenerate failed', err);
      toast({
        title: 'Brief generation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  }, [userId, loadLatest, toast]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setBundle(null);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const existing = await loadLatest();
      if (cancelled) return;
      if (
        !existing ||
        Date.now() - new Date(existing.brief.generated_at).getTime() > STALE_THRESHOLD_MS
      ) {
        setBundle(existing);
        await regenerate({ force: true });
      } else {
        setBundle(existing);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadLatest, regenerate]);

  /**
   * Auto-refresh: when the user changes preferences, saves a property/analysis,
   * or edits their owned-property portfolio, regenerate the brief in the
   * background (respecting the cooldown). Uses Supabase realtime.
   */
  useEffect(() => {
    if (!userId) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = (reason: string) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.info('[investorBrief] auto-refresh trigger:', reason);
        void regenerate({ silent: true });
      }, 2500);
    };

    const tables: Array<{ table: string; filter: string }> = [
      { table: 'profiles', filter: `id=eq.${userId}` },
      { table: 'saved_properties', filter: `user_id=eq.${userId}` },
      { table: 'saved_analyses', filter: `user_id=eq.${userId}` },
      { table: 'investor_owned_properties', filter: `user_id=eq.${userId}` },
    ];

    const channel = supabase.channel(`investor-brief-${userId}`);
    for (const { table, filter } of tables) {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, filter },
        () => scheduleRefresh(table),
      );
    }
    channel.subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [userId, regenerate]);

  const isStale = bundle
    ? Date.now() - new Date(bundle.brief.generated_at).getTime() > 30 * 60 * 60 * 1000
    : false;

  const effectiveIntro = bundle?.brief.edited_intro ?? bundle?.brief.intro_text ?? '';
  const effectiveInsights: InsightBullet[] =
    bundle?.brief.edited_insights ?? bundle?.brief.insights ?? [];

  return {
    bundle,
    loading,
    refreshing,
    isStale,
    regenerate,
    effectiveIntro,
    effectiveInsights,
  };
}