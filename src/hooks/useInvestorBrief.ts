import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { composeBriefCards } from '@/lib/investorBrief/briefComposer';
import { parseAndRecordBudget402 } from '@/lib/ai/budgetCap';
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

      // Optimistic render: paint freshly composed cards immediately so the
      // user sees data while the narration is still generating. Keep prior
      // intro/insights visible during the swap.
      setBundle((prev) => {
        const composedById: Record<string, ComposedCard> = {};
        for (const c of cards) composedById[c.id] = c;
        const placeholderCards: PersistedBriefCard[] = cards.map((c, i) => ({
          id: c.id,
          brief_id: prev?.brief.id ?? 'pending',
          card_type: c.cardType,
          position: i,
          config: c.config,
          data_snapshot: {
            title: c.title,
            subtitle: c.subtitle,
            data: c.data,
            summary: c.summary,
            investigatePrompt: c.investigatePrompt,
            sources: c.sources,
            isEstimate: c.isEstimate,
          },
        })) as unknown as PersistedBriefCard[];
        return {
          brief: prev?.brief ?? ({
            id: 'pending',
            user_id: userId,
            status: 'pending',
            intro_text: '',
            insights: [],
            followups: [],
            generated_at: new Date().toISOString(),
            context_snapshot: null,
          } as unknown as PersistedBrief),
          cards: placeholderCards,
          context: { preferences: context.preferences } as unknown as ContextSnapshot,
          composedById,
        };
      });

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
        // Daily cap hit — record state so the BudgetCapBanner / Blocker
        // show, suppress the generic destructive toast.
        if (await parseAndRecordBudget402(error, 'investor_brief')) {
          return;
        }
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

      // Hydrate directly from the edge function response — saves two
      // sequential selects on the round trip.
      const briefResp = data?.brief;
      const cardsResp = (data?.cards ?? []) as PersistedBriefCard[];
      if (briefResp && cardsResp.length > 0) {
        setBundle({
          brief: briefResp as PersistedBrief,
          cards: cardsResp,
          context: { preferences: context.preferences } as unknown as ContextSnapshot,
          composedById: buildComposedFromPersisted(cardsResp),
        });
      } else {
        const fresh = await loadLatest();
        setBundle(fresh);
      }
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
    let inFlight = false;
    const scheduleRefresh = (reason: string) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (inFlight) return;
        console.info('[investorBrief] auto-refresh trigger:', reason);
        inFlight = true;
        void regenerate({ silent: true }).finally(() => {
          inFlight = false;
        });
      }, 5000);
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