
# Investor Console v2 + Brief — Build Plan

Replaces today's `/investor` (calculator + tabs) with a two-surface Investor experience:

- **`/investor`** — Manager Brief homepage (rail + brief card + insight grid).
- **`/investor/console`** — Chat-first console with sidebar; Investigate links land here with grounded context.
- **`/investor/calculator`** — Existing calculator preserved, moved one level down (still linked from rail and console).

Old `Investor.tsx` (Calculator / Comparator / Saved Analyses tabs) is removed. Saved Analyses + Market Comparator move into the console as side panels (reachable from rail). Hard cutover — no `investor_console_v2` flag.

Daily cadence, 5 cards default, fresh-regenerate each cycle, `google/gemini-2.5-pro` via Lovable AI Gateway.

---

## 1. Database (one migration)

Tables, all with RLS scoped to `auth.uid()`:

- `investor_briefs` — one row per generated brief (intro_text, insights jsonb, followups[], context_snapshot, status, edited_intro, edited_insights, generated_at).
- `investor_brief_cards` — one row per card in a brief (brief_id, card_type, position, config, data_snapshot, hidden).
- `investor_talking_points` — user-pinned points (text, source_card_id, source_card_type, status).
- `investor_card_feedback` — thumbs/investigate/copy/pin/dismiss signals per card_type.

Indices: `(user_id, generated_at desc)`, `(brief_id, position)`, `(user_id, card_type, created_at desc)`.

Brief cards policy uses subquery on parent brief's user_id (per `user-roles` pattern, no recursion risk since it's a different table).

## 2. Edge functions

### `supabase/functions/investor-brief/index.ts` (new)
- Input: `{ contextSnapshot, selectedCards: [{type, config, dataSummary}] }`.
- Calls Lovable AI Gateway with `google/gemini-2.5-pro` via shared `_shared/ai-gateway.ts` wrapper.
- System prompt grounded in the cards (rules: cite ≥1 card per bullet, frame against user targets, no hedging, severity sparingly).
- Persists `investor_briefs` + `investor_brief_cards` rows server-side using service-role client (with user_id from JWT).
- Returns the persisted brief.
- Uses `_shared/aiCredits.ts` to deduct (matches project convention).

### `supabase/functions/regenerate-briefs-cron/index.ts` (new)
- Protected by `_shared/cronAuth.ts` (X-Cron-Secret).
- Iterates users where `brief_cadence` matches today + opted in; enqueues per-user regeneration by re-running composer server-side (shared composer module lives in edge `_shared/briefComposer.ts` for cron + on a server route called from client refresh).
- Scheduled via `pg_cron` daily at 09:00 UTC (handles local 5am for US users; configurable later).

Cron schedule SQL goes through `supabase--insert` (per project rules, not migration) when ready.

## 3. Insight registry (`src/lib/investorBrief/insightRegistry.ts`)

Single source of truth. Each entry:

```ts
{ id, cardType, title, subtitle?, isEligible(ctx), loadData(ctx),
  basePriority, scorePriority?(ctx, feedback), toBriefSummary(data),
  investigatePrompt(data) }
```

Ship with: `cap_rate_trend`, `watchlist_price_trend`, `price_reduction_heatmap`, `top_matches_today`, `missing_data`, `target_breach`, `cluster_alert`, `inactive_search`. Plus `setup_card` + `sample_card` for cold-start.

Composer (`briefComposer.ts`):
1. Load preferences, last 25 saved analyses, last 25 memorized properties, last 10 searches.
2. Filter eligible cards.
3. Parallel `loadData` (mostly local; some hit Supabase for market aggregates).
4. Score via base + feedback (Bayesian-smoothed thumbs ratio over 30 days, `investigated` and `pinned` boost, `down`/`dismissed` demote).
5. Pick top N (default 5).

Card data is frozen into `data_snapshot` at generation time — brief is point-in-time.

## 4. Pages, routes, contexts

### Routes (in `src/App.tsx`)
- `/investor` → `InvestorBrief` (default homepage of section).
- `/investor/console` → `InvestorConsole` (chat).
- `/investor/console?cardId=&prompt=` → same page, reads params to ground the chat.
- `/investor/calculator` → existing `HomeLensInvestorCalculator` page (extract from current `Investor.tsx`).
- Old `/investor` Tabs UI removed; Market Comparator + SavedAnalysesContent reachable from console rail.

### Contexts
- `InvestorConsoleContext` — preferences, memorized properties, saved analyses, searches subscriptions (reused by both surfaces).
- `InvestorBriefContext` — wraps console context; adds current brief, talking points, refresh state.

### Brief page tree
```text
InvestorBrief
├── ConsoleSidebar (rail mode, icon-only)
├── BriefCard (Prepared by HomeLens · intro · insights · followups · reactions · composer)
└── DashboardGrid
    ├── InsightCard × N (dispatches by card_type)
    ├── NoteCallout (latest talking point)
    └── BottomActionBar (Edit · Add Talking Point)
```

### Console page tree
```text
InvestorConsole
├── ConsoleSidebar (expanded; sections: Chat, Saved Analyses, Comparator, Calculator, Talking Points)
├── ChatPanel (existing chat primitives — reuses ai-chat edge fn)
└── Right rail (preferences summary, memorized properties)
```

## 5. Components to create

- `src/pages/InvestorBrief.tsx`, `src/pages/InvestorConsole.tsx`, `src/pages/InvestorCalculator.tsx`
- `src/components/investor/console/ConsoleSidebar.tsx`
- `src/components/investor/brief/`: `BriefCard`, `InsightCard`, `NoteCallout`, `BottomActionBar`, `BriefEditDialog`, `TalkingPointPicker`
- `src/components/investor/brief/cards/`: `TrendChartCard`, `HeatmapCard`, `RankedListCard`, `AnomalyCard`, `MissingDataCard`, `SetupCard`, `SampleCard`
- `src/lib/investorBrief/`: `insightRegistry.ts`, `briefComposer.ts`, `intoCards.ts`, `feedback.ts`, `telemetry.ts`
- `src/contexts/InvestorConsoleContext.tsx`, `src/contexts/InvestorBriefContext.tsx`
- `src/hooks/useInvestorBrief.ts` (current brief + refresh action with 5min rate limit)

Charts via existing `recharts` + `@/components/ui/chart`. Heatmap as Tailwind grid (no new dep).

## 6. Interactions

- **Investigate**: card → `/investor/console?cardId=<uuid>&prompt=<encoded>`. Console reads card from DB, injects system message *"User is investigating <title>. Card shows: <toBriefSummary>"*, auto-sends `prompt`.
- **Brief composer input**: submits → navigates to `/investor/console` with the typed query as first message (no separate chat thread on brief).
- **Reactions**: thumbs/copy/open-in-new/overflow (Dismiss · Pin as Talking Point · Hide this card type) → write `investor_card_feedback`; Dismiss flips `hidden=true` for this brief only.
- **Edit dialog**: drag reorder, hide, override intro/bullets. Persists to `edited_intro`/`edited_insights`. Next cycle regenerates fresh (edits = point-in-time).
- **Talking Points**: pinned items appear as NoteCallout next brief; LLM prompt receives them so it can reference.
- **Refresh button**: rate-limited 1/5min; on stale (>30h) shows "Refresh recommended" pill.

## 7. Cold-start

User with no prefs/properties/analyses gets welcome `introText`, `SetupCard` (CTA to `/profile-setup`), and `SampleCard` (static demo). Bottom action bar disabled.

## 8. Mobile (≤768px)

Rail collapses to bottom tab in `Navigation`. Brief card stacks above dashboard grid (single column). BottomActionBar sticky.

## 9. Telemetry

New helper `telemetry.ts` writes to existing `tool_call_telemetry` pattern OR a new lightweight `investor_brief_events` table (proposed in same migration) with events: `opened`, `card_rendered`, `card_investigated`, `card_reaction`, `talking_point_added`, `edited`, `refreshed`, `composer_query_sent`.

## 10. Memory & cleanup

- Update `mem://funcionalidades/pagina-investor-foco-calculadora` → `/investor` is now Brief; calculator at `/investor/calculator`.
- Add `mem://features/investor-brief` — registry pattern, point-in-time semantics, Investigate routing contract.
- Remove old `Investor.tsx`'s tab UI.

## 11. Verification

End-to-end smoke (via browser + supabase tools):
1. New user lands on `/investor` → cold-start brief renders with 2 cards, no errors.
2. Seeded user → brief skeleton → 3–5 cards within ~5s, intro/insights cite card ids.
3. Investigate on cap-rate-trend → console opens, AI first message references ZIP/window/value.
4. Thumb-down heatmap 3× → next 3 regenerations demote it out of top 5.
5. Pin talking point → next brief shows NoteCallout + LLM references it.
6. Edit override persists; manual regenerate restores AI output.
7. Refresh 5× in 30s → second+ return cached, tooltip shows wait.
8. RLS: query user B's brief as user A → denied.
9. Brief stability: memorize new property mid-day → brief unchanged until refresh, console reflects immediately.
10. Mobile 375px: rail collapsed, single-column stack, sticky bar.

## 12. Commit order

1. Migration: 4 brief tables + RLS + indices + `brief_cadence` + `brief_card_count` columns on `profiles`.
2. Insight registry + composer (no UI).
3. `investor-brief` edge function + LLM prompt.
4. Page shells (`InvestorBrief`, `InvestorConsole`, `InvestorCalculator`) + routes + sidebar.
5. BriefCard + card renderers (trend, heatmap, ranked_list, anomaly, missing_data, note).
6. Investigate routing + grounded chat context in console.
7. Reactions, talking points, BriefEditDialog.
8. Cron edge function + pg_cron schedule (via `supabase--insert`).
9. Telemetry + feedback-driven priority adjustments.
10. Mobile pass + cold-start polish + memory updates.

---

## Out of scope

Email delivery of brief, multi-user briefs, brief history archive UI, AI-authored card types, cross-user benchmarks, non-investor persona briefs. Per the prompt.
