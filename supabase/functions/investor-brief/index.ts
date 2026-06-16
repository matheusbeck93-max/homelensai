/**
 * investor-brief edge function
 *
 * Generates the natural-language portion of a user's Investor Brief
 * grounded in the cards the client composed. Persists the brief +
 * cards and returns the saved record.
 *
 * Body:
 *   {
 *     contextSnapshot: any,
 *     selectedCards: Array<{
 *       type: string,
 *       title: string,
 *       config: any,
 *       dataSnapshot: any,
 *       summary: string,
 *     }>,
 *     pinnedTalkingPoints?: string[],
 *   }
 *
 * Returns: { brief: { id, intro_text, insights, followups, generated_at }, cards: [...] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { enforceFeature } from '../_shared/tierGate.ts';
import { completeWithFallback, BudgetExceededError } from '../_shared/ai/router.ts';
import { ProviderError } from '../_shared/ai/types.ts';
import { getFredSeries } from '../_shared/fred-client.ts';
import { FRED_SERIES } from '../_shared/fred-series.ts';

/**
 * Frozen-at-generation macro snapshot for the brief. Cache-first FRED
 * fetch (24h prefetch warms it); fails soft to null if FRED unreachable.
 */
async function loadMacroContextForBrief(): Promise<{
  rate_30y_pct: number | null;
  rate_30y_change_30d_bps: number | null;
  rate_as_of: string | null;
  case_shiller_national: number | null;
  case_shiller_yoy_pct: number | null;
  source: string;
} | null> {
  try {
    const [r30, cs] = await Promise.all([
      getFredSeries(FRED_SERIES.MORTGAGE_30Y, { limit: 60 }),
      getFredSeries(FRED_SERIES.CASE_SHILLER_NATL, { limit: 24 }),
    ]);
    const p30 = r30.payload;
    const csP = cs.payload;
    const csVal = csP.latest?.value ?? null;
    const csYoy =
      csVal != null && csP.change_yoy
        ? +((csP.change_yoy.absolute / (csVal - csP.change_yoy.absolute)) * 100).toFixed(2)
        : null;
    return {
      rate_30y_pct: p30.latest?.value ?? null,
      rate_30y_change_30d_bps: p30.change_30d?.percent_pts ?? null,
      rate_as_of: p30.latest?.date ?? null,
      case_shiller_national: csVal,
      case_shiller_yoy_pct: csYoy,
      source: 'FRED',
    };
  } catch (_e) {
    return null;
  }
}

// Router decides the model per surface/tier (Sonnet for free/buyer,
// premium for investor). Legacy direct-gateway fallback removed — it was
// the slowest path and kept the brief stuck on Gemini 2.5 Pro for all tiers.

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildSystemPrompt(): string {
  return [
    'You are HomeLens Investor Brief — you write the natural-language portion of a',
    "real-estate investor's daily brief.",
    '',
    'You receive:',
    "  - The user's preferences (target cap rate, target markets, etc.)",
    '  - A list of insight cards already selected for this brief, each with an id,',
    '    title, and a one-line summary of what the card shows.',
    '  - Any pinned talking points the user wants you to reference.',
    '  - macro_context: today\'s 30-yr mortgage rate and Case-Shiller national HPI.',
    '    Use it for the intro line ("Today\'s rate: 6.78% (-15 bps over 30 days)")',
    '    and any insight that benefits from rate context. Always attribute with',
    '    "(per FRED)". Skip silently when macro_context is null.',
    '',
    'Output STRICT JSON ONLY (no markdown, no commentary):',
    '{',
    '  "introText": "1–2 sentence intro mentioning what the brief was built from.",',
    '  "insights": [',
    '    { "text": "...", "citedCardIds": ["<id>"], "severity": "info" }',
    '  ],',
    '  "followups": ["short question", "..."]',
    '}',
    '',
    'Rules:',
    '- 3–5 bullets in insights. Each must cite ≥1 card id from the input.',
    '- Describe what the card shows. Do NOT introduce metrics no card supports.',
    "- Frame against the user's targets when relevant (e.g., \"above your 7% target\").",
    '- severity is one of: "info" | "opportunity" | "warning". Use "warning" sparingly.',
    '- Tone: factual, concise, second-person.',
    '- 2–4 short followups the user could click next.',
    '- US real estate only.',
  ].join('\n');
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const gate = await enforceFeature(req, 'INVESTOR_CALCULATOR');
    if (!gate.ok) return gate.error;

    const body = await req.json();
    const contextSnapshot = body?.contextSnapshot ?? {};
    const selectedCards: Array<any> = Array.isArray(body?.selectedCards) ? body.selectedCards : [];
    const pinnedTalkingPoints: string[] = Array.isArray(body?.pinnedTalkingPoints)
      ? body.pinnedTalkingPoints.filter((s: unknown) => typeof s === 'string')
      : [];

    if (selectedCards.length === 0) {
      return jsonResponse({ error: 'No cards provided' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Create brief row in 'pending' status with a stable id we can reference
    //    for card insertion below.
    const { data: briefRow, error: briefInsertError } = await supabase
      .from('investor_briefs')
      .insert({
        user_id: user.id,
        status: 'pending',
        intro_text: '',
        insights: [],
        context_snapshot: contextSnapshot,
      })
      .select('id')
      .single();

    if (briefInsertError || !briefRow) {
      console.error('Failed to create brief row', briefInsertError);
      return jsonResponse({ error: 'Failed to create brief' }, 500);
    }

    const briefId = briefRow.id;

    // 2. Insert cards with positions. The LLM cites by the card id we send it,
    //    which is the freshly-generated DB id.
    const cardRows = selectedCards.map((c, i) => ({
      brief_id: briefId,
      card_type: String(c.type ?? 'note'),
      position: i,
      config: c.config ?? {},
      data_snapshot: c.dataSnapshot ?? {},
    }));

    const { data: insertedCards, error: cardsError } = await supabase
      .from('investor_brief_cards')
      .insert(cardRows)
      .select('id, card_type, position, config, data_snapshot');

    if (cardsError || !insertedCards) {
      console.error('Failed to insert brief cards', cardsError);
      return jsonResponse({ error: 'Failed to insert cards' }, 500);
    }

    // 3. Build LLM payload using the persisted card ids so citations are stable.
    const cardsForPrompt = insertedCards
      .sort((a, b) => a.position - b.position)
      .map((row, i) => ({
        id: row.id,
        type: row.card_type,
        title: selectedCards[i]?.title ?? row.card_type,
        // Cap summary length — shorter prompts = faster TTFB.
        summary: String(selectedCards[i]?.summary ?? '').slice(0, 240),
      }));

    const userMessage = JSON.stringify({
      preferences: contextSnapshot?.preferences ?? {},
      cards: cardsForPrompt,
      pinnedTalkingPoints,
      macro_context: await loadMacroContextForBrief(),
    });

    // 4. Call Lovable AI Gateway via the router for all tiers. The router
    //    enforces budget caps and picks the right model per surface/tier.
    let raw = '{}';
    try {
      const rawTier = contextSnapshot?.tier;
      const tier: 'free' | 'buyer' | 'investor' =
        rawTier === 'investor' || rawTier === 'premium'
          ? 'investor'
          : rawTier === 'buyer' || rawTier === 'paid'
            ? 'buyer'
            : 'free';
      const result = await completeWithFallback(
        'investor_brief',
        {
          system: buildSystemPrompt(),
          messages: [{ role: 'user', content: userMessage }],
          responseFormat: 'json',
          temperature: 0.4,
        },
        { userId: user.id, tier },
      );
      raw = result.text || '{}';
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        await supabase.from('investor_briefs').update({ status: 'failed' }).eq('id', briefId);
        return jsonResponse({ error: 'Credits exhausted' }, 402);
      }
      if (err instanceof ProviderError && err.status === 429) {
        await supabase.from('investor_briefs').update({ status: 'failed' }).eq('id', briefId);
        return jsonResponse({ error: 'Rate limited' }, 429);
      }
      console.error('[investor-brief] router error', err);
      await supabase.from('investor_briefs').update({ status: 'failed' }).eq('id', briefId);
      return jsonResponse({ error: 'AI generation failed' }, 502);
    }

    let parsed: { introText?: string; insights?: any[]; followups?: string[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const introText = typeof parsed.introText === 'string' && parsed.introText.length > 0
      ? parsed.introText
      : 'Today\'s brief built from your preferences and watchlist.';

    const validCardIds = new Set(insertedCards.map((c) => c.id));
    const insights = Array.isArray(parsed.insights)
      ? parsed.insights
          .filter((b: any) => b && typeof b.text === 'string')
          .map((b: any) => ({
            text: String(b.text).slice(0, 600),
            citedCardIds: Array.isArray(b.citedCardIds)
              ? b.citedCardIds.filter((id: any) => typeof id === 'string' && validCardIds.has(id))
              : [],
            severity: ['info', 'opportunity', 'warning'].includes(b.severity) ? b.severity : 'info',
          }))
          .slice(0, 5)
      : [];

    const followups = Array.isArray(parsed.followups)
      ? parsed.followups
          .filter((s: any) => typeof s === 'string')
          .map((s: string) => s.slice(0, 120))
          .slice(0, 4)
      : [];

    // 5. Finalize brief row.
    const { error: updateError } = await supabase
      .from('investor_briefs')
      .update({
        status: 'ready',
        intro_text: introText,
        insights,
        followups,
      })
      .eq('id', briefId);

    if (updateError) {
      console.error('Failed to finalize brief', updateError);
      return jsonResponse({ error: 'Failed to save brief' }, 500);
    }

    return jsonResponse({
      brief: {
        id: briefId,
        intro_text: introText,
        insights,
        followups,
        generated_at: new Date().toISOString(),
        status: 'ready',
      },
      cards: insertedCards,
    });
  } catch (err) {
    console.error('investor-brief unexpected error', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});