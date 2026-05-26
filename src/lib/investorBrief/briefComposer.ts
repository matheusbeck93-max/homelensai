import { supabase } from '@/integrations/supabase/client';
import { adjustPriority, insightRegistry } from './insightRegistry';
import type {
  ComposedCard,
  ContextSnapshot,
  FeedbackSignal,
} from './types';
import { blendedWeights, type PersonaId } from '@/lib/personas/personaRegistry';

/**
 * Build the context snapshot from the current user's recent data.
 */
export async function loadContextSnapshot(userId: string): Promise<ContextSnapshot> {
  const [profileResp, propsResp, analysesResp, talkingPointsResp] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'primary_goal, preferred_cities, max_price_range, min_bedrooms, about_me, brief_card_count, cash_available, financing_defaults, persona, persona_secondary',
      )
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('saved_properties')
      .select('id, property_address, property_url, city, state, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('saved_analyses')
      .select('id, property_address, property_price, investment_score, key_metrics, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('investor_talking_points')
      .select('id, text, source_card_type, pinned_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('pinned_at', { ascending: false })
      .limit(10),
  ]);

  return {
    preferences: {
      primary_goal: profileResp.data?.primary_goal ?? null,
      preferred_cities: profileResp.data?.preferred_cities ?? null,
      max_price_range: profileResp.data?.max_price_range ?? null,
      min_bedrooms: profileResp.data?.min_bedrooms ?? null,
      about_me: profileResp.data?.about_me ?? null,
      brief_card_count: profileResp.data?.brief_card_count ?? 5,
      cash_available: (profileResp.data as any)?.cash_available ?? null,
      financing_defaults: (profileResp.data as any)?.financing_defaults ?? null,
      persona: (profileResp.data as any)?.persona ?? 'mixed',
      persona_secondary: (profileResp.data as any)?.persona_secondary ?? [],
    },
    savedProperties: (propsResp.data ?? []) as ContextSnapshot['savedProperties'],
    savedAnalyses: (analysesResp.data ?? []) as unknown as ContextSnapshot['savedAnalyses'],
    pinnedTalkingPoints: (talkingPointsResp.data ?? []) as ContextSnapshot['pinnedTalkingPoints'],
  };
}

async function loadFeedback(userId: string): Promise<FeedbackSignal[]> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await supabase
    .from('investor_card_feedback')
    .select('card_type, signal, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .limit(500);
  return (data ?? []) as FeedbackSignal[];
}

export async function composeBriefCards(userId: string): Promise<{
  context: ContextSnapshot;
  cards: ComposedCard[];
}> {
  const [context, feedback] = await Promise.all([
    loadContextSnapshot(userId),
    loadFeedback(userId),
  ]);

  const personaId = (context.preferences.persona ?? 'mixed') as PersonaId;
  const secondary = ((context.preferences.persona_secondary ?? []) as string[]).filter((s) =>
    ['first_time_buyer', 'rental_investor', 'flipper', 'institutional'].includes(s),
  ) as PersonaId[];
  const { briefCardWeights } = blendedWeights(personaId, secondary);

  const eligible = insightRegistry.filter((def) => {
    try {
      return def.isEligible(context);
    } catch {
      return false;
    }
  });

  // Load data in parallel.
  const loaded = await Promise.all(
    eligible.map(async (def) => {
      try {
        const data = await def.loadData(context);
        const basePriority = adjustPriority(def, context, feedback);
        // Persona signal: weight in [0,1] mapped to a [-15, +15] bump.
        const w = briefCardWeights[def.id] ?? 0.5;
        const personaSignal = Math.round((w - 0.5) * 30);
        const priority = basePriority + personaSignal;
        const card: ComposedCard = {
          id: def.id,
          cardType: def.cardType,
          title: def.title(context, data),
          subtitle: def.subtitle?.(context, data),
          data,
          config: { registryId: def.id },
          summary: def.toBriefSummary(data),
          investigatePrompt: def.investigatePrompt(data),
          priority,
        };
        return card;
      } catch (err) {
        console.warn(`[briefComposer] loadData failed for ${def.id}`, err);
        return null;
      }
    }),
  );

  const validCards = loaded.filter((c): c is ComposedCard => c !== null);
  validCards.sort((a, b) => b.priority - a.priority);

  const n = Math.max(1, Math.min(7, context.preferences.brief_card_count ?? 5));
  return { context, cards: validCards.slice(0, n) };
}