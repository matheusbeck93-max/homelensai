# Investor Chat Quality Fix

Ships Parts 1–6 of the fix prompt as quality wins on the current model. Part 7 (model A/B) and Part 8 (telemetry) are out of this pass — call them out as follow-ups so we don't bloat one change.

## What changes

### 1. Session filters (exploration ≠ preference change)
- Add `SessionFilters` state to `InvestorBriefContext` (markets add/replace, budget, capRate, beds, baths, note, setAt). Per-thread, in-memory + persisted to `localStorage` keyed by `threadId` so a refresh keeps the exploration scope.
- New tool `apply_session_filter` in `investor-chat/index.ts` — mutates session filters via an SSE event back to the client; no DB write.
- New `ExploringPill` component above the chat composer in `DeepPanel`. Shows active overrides + Reset button.

### 2. Data tools accept `filterMode` + resolver
- Extend input schemas of market/listings tools (`get_market_stats`, `list_listings`, `compute_budget_affordability`, `find_comparable_sales`, etc.) with `filterMode: "preferences" | "session" | "explicit"` (default `"session"`).
- Add `resolveMarkets(input, ctx, sessionFilters)` and `resolveBudget(...)` helpers in `supabase/functions/investor-chat/index.ts`, applied before tool execution.

### 3. `get_market_stats` fills the metric gap
- Extend output with `medianSqft`, `medianPricePerSqft`, `medianRentPerSqft` and derivation sources.
- New `supabase/functions/_shared/marketStatsDerive.ts` (and mirrored client copy under `src/lib/investorChat/marketStatsDerive.ts`) that computes missing ratios from list price / sqft and rent / sqft.
- `MarketStatsCard` shows a small "· derived" tag next to derived values.

### 4. Tool descriptions adopt USE / DO NOT USE / EXAMPLES
- Rewrite the `description` strings for the routing-sensitive tools (`get_market_stats`, `list_listings`, `compute_metrics`, `compare_properties`, `find_comparable_sales`, `compute_budget_affordability`) so the model picks the right one from natural-language phrasing.

### 5. System prompt rewrite + few-shot examples
- Replace the investor-chat system prompt with the structure in Part 6: identity, context block (already injected via shared `userInvestorContext`), behavioral rules (use loaded context, exploration vs preferences, tool selection, don't bail on derivable metrics, voice), and 3 few-shot examples.

### 6. Deep panel: active-turn-only visuals
- In `DeepPanel`, render only the active turn's tool events (current streaming turn, or — when idle — the most recent assistant turn). Prior-turn events stop accumulating below new ones.
- Source card visual (when entering Deep Dive from a card) is preserved separately.

## Out of scope (explicit)
- Part 7 model A/B (Haiku vs Sonnet) and Part 8 thumbs/telemetry — ship after #1–6 land and we can see the quality lift on the current model.
- IntersectionObserver chat-history scrollback (depends on the deep-panel history work referenced in the prompt but not yet built).
- Free-form preference updates via chat (kept on `/profile-setup`).

## Files touched

- `src/contexts/InvestorBriefContext.tsx` — add SessionFilters state + persistence
- `src/components/investor/brief/deep/DeepPanel.tsx` — active-turn-only events + Exploring pill
- `src/components/investor/brief/deep/ExploringPill.tsx` (new)
- `src/components/investor/chat/visuals/MarketStatsCard.tsx` — show derived tag, render new metrics
- `src/lib/investorChat/marketStatsDerive.ts` (new, client mirror — optional, used only if MarketStatsCard needs to re-derive)
- `src/lib/investorChat/streamClient.ts` — handle new `session_filter_update` SSE event
- `supabase/functions/_shared/marketStatsDerive.ts` (new)
- `supabase/functions/investor-chat/index.ts` — new tool, filterMode resolver, derive call, prompt rewrite, tool description overhaul

## Verification

After deploy, on `/investor`:
1. Ask "include Arlington Virginia in the visual" — pill appears, data includes Arlington, no save prompt.
2. Click × on pill — next tool call drops Arlington.
3. Ask "median $/sqft in Tampa" — replies with derived value + label, no "I don't have it" fallback.
4. Three-turn sequence (Arlington listings → Tampa stats → Austin properties) — right panel only shows the latest turn's visuals.
5. Ask "my budget" / "my cap rate target" — answered from preferences, no prompt back to the user.