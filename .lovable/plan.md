## Goal
Three coordinated changes to `/investor`:
1. Rename **Investigate → Deep Dive** (UI only; telemetry stays).
2. **Visual continuity**: when the user opens a Deep Dive, the right panel immediately renders the source card's visual at higher detail, plus starter follow-up prompts. No empty placeholder.
3. **QA audit** of the preferences → context → tools → brief pipeline. Fix small issues inline, file larger ones as `NEEDS DESIGN`.

---

## Part 1 — Rename Investigate → Deep Dive

UI-string only. Telemetry signals (`investor_card_feedback.signal = 'investigated'`) stay — comment once for future readers. The `investigatePrompt` field in `InsightDefinition` keeps its name (referenced widely); only user-visible text changes.

**Files touched:**
- `src/components/investor/brief/InsightCard.tsx` — button label, tooltip, aria-label, dropdown wording.
- `src/components/investor/brief/deep/DeepPanel.tsx` — back chevron, empty-state copy.
- Any `cards/*.tsx` referencing the word.
- Comment on the `'investigated'` signal write.

Copy:
- Button: `Deep Dive`
- Tooltip: *"Open a deep dive on this card with AI follow-up."*
- aria-label: *"Open deep dive on {title}"*

---

## Part 2 — Visual continuity into the Deep Dive

### Data model additions (no migrations)

In `src/lib/investorBrief/types.ts` (InsightDefinition):
```ts
deepDiveStarterPrompts?: (data: any, ctx: any) => string[];
deepDiveTool?: { name: string; inputFromData: (data, ctx) => unknown };
```

### Context changes (`src/contexts/InvestorBriefContext.tsx`)

Add a **seeded tool event** when entering chat-from-card so `DeepPanel` has something to render immediately:

```ts
enterChatModeFromCard(card, severity) {
  ...
  const seedEvent: ToolEvent = {
    id: `seed_${card.id}`,
    name: `__source_${card.cardType ?? 'card'}`,
    input: { cardId: card.id, title: card.title },
    output: { density: 'deepDive', card }, // full ComposedCard payload
    status: 'done',
    anchor: 'right',
  };
  // store on a new `seededEventsByKey` map keyed by card.id
}
```

Also expose `starterPromptsByKey` so `DeepPanel` can render starter chips.

### DeepPanel changes (`src/components/investor/brief/deep/DeepPanel.tsx`)

- Read `seededEventsByKey[activeThreadKey]` and prepend to `allEvents`.
- When no live events yet: render the seeded source card visual at the top + a `StarterPrompts` row.
- Empty-state placeholder only fires when there is no seed AND no events AND no streaming — i.e., freeform chat.

### Source-card renderer (new)

`src/components/investor/brief/deep/SourceCardVisual.tsx` — takes a `ComposedCard`, dispatches by `cardType` and renders a **larger** version. To avoid touching every per-card file, the first pass simply re-uses `BriefCardRenderer` wrapped in a class that increases chart height and shows more rows (`density="deepDive"` data attribute + CSS overrides via a wrapper).

Per-card visual variants are out-of-scope-deferable; we add the density wrapper now and let individual cards opt in later.

### Starter prompts

`src/components/investor/brief/deep/StarterPrompts.tsx` — renders 3 chips; clicking a chip calls `sendTurn(prompt)`.

Per-card prompts live in `insightRegistry.ts` via `deepDiveStarterPrompts`. Provide a sensible **default fallback** by `cardType`:
- `cap_rate_trend` → ZIPs / memorized properties benefit / project 6mo
- `budget_vs_market` → listings within budget / +20% budget / neighboring markets
- `watchlist_price_trend` → which moved most / crossed threshold / project 12mo
- `price_reduction_heatmap` → hottest ZIP affordable / memorized in zone / what's driving
- `portfolio_glance` → walk through / strongest return / over-concentrated
- `portfolio_alerts` → top alert deep dive / rank by impact / act first
- `missing_data` → fix for me / show impact / same gap elsewhere
- default → *"Tell me more about {title}"*, *"Compare to my portfolio"*, *"Project this forward"*

### System prompt (deep-dive mode)

In `supabase/functions/investor-chat/index.ts` (or the prompt builder it uses), when `activeCardContext` is present append:

> *The user is deep-diving on "{card.title}". The right panel already shows the source visual at full detail — do NOT re-fetch the same data. Use follow-up tools to (a) surface a different cut, (b) augment with overlays, (c) stack a related visual, or (d) project forward. Preferences, memorized properties, saved analyses and recent searches are already loaded — reference them directly.*

### Augment / stack / replace

Full heuristic is non-trivial (would require shared output-type metadata across tools). **Filed as NEEDS DESIGN** for this pass. We'll ship: seed visual + stacking of new tool results below it (existing DeepPanel behavior). Replacement happens implicitly when the user pivots. Augment overlays deferred.

---

## Part 3 — QA self-audit

I'll execute the A–I checklist by reading code and DB rows where possible (RLS prevents per-user testing without a session), report PASS/FAIL/NEEDS DESIGN inline at the end of the implementation message. Items requiring a live user account (e.g., E4 persona switch reflow, F3 click + stream) will be marked `NEEDS LIVE QA` with the code-level verification I was able to do.

I will fix anything ≤10 lines inline (e.g., a missing field in the context snapshot builder). Bigger gaps reported as `NEEDS DESIGN`.

---

## Files to create
- `src/components/investor/brief/deep/SourceCardVisual.tsx`
- `src/components/investor/brief/deep/StarterPrompts.tsx`
- `src/lib/investorBrief/deepDiveStarters.ts` (default per-cardType prompts)

## Files to edit
- `src/components/investor/brief/InsightCard.tsx` (rename + tooltip + aria)
- `src/components/investor/brief/deep/DeepPanel.tsx` (seed + starters + back label)
- `src/contexts/InvestorBriefContext.tsx` (seededEventsByKey, starterPromptsByKey)
- `src/lib/investorBrief/types.ts` (optional fields on InsightDefinition)
- `src/lib/investorBrief/insightRegistry.ts` (wire defaults — minimal)
- `supabase/functions/investor-chat/index.ts` (deep-dive prompt suffix) — only if a clean injection point exists; otherwise reported as NEEDS DESIGN.

## Out of scope (per the prompt)
- Visual diff animation, pin/unpin, shareable deep dive, voice input on composer, full augment/overlay merge engine, density-aware rewrites of every card variant.