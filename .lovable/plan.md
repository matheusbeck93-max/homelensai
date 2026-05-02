Saved Analyses — Implementation Plan (confirmed)

## Confirmed decisions

1. **Score scale:** store `investment_score` as **0–100** (MATCH_SCORE × 10).
2. **Save button gate:** only renders on assistant messages with a parsed `MATCH_SCORE` (real property analyses) — never on generic chat replies or multi-property carousels.

## Database (migration)

`public.saved_analyses` — fields per spec, with these refinements:

- `investment_score INTEGER` storing 0–100.
- 4 separate RLS policies (SELECT/INSERT/UPDATE/DELETE) using `auth.uid() = user_id`.
- Partial unique index `(user_id, property_url) WHERE property_url IS NOT NULL` to enforce no-duplicate-by-URL.
- `updated_at` trigger reusing existing `update_updated_at_column()`.

## Edge function — `supabase/functions/save-analysis/index.ts`

- POST, validates JWT in code, shared `corsHeaders`, pinned esm.sh deps, structured logging.
- Zod validation of body. `investmentScore` accepted as 0–100 integer.
- Loads `profiles.subscription_status` → if not `premium`, return 403 `{ error: 'premium_required' }`.
- Duplicate check by `(user_id, property_url)` → 409 `{ error: 'already_saved' }`.
- Inserts row → returns `{ success: true, id }`.

## Hook — `src/hooks/useSavedAnalyses.ts`

`fetchSavedAnalyses`, `saveAnalysis` (via `supabase.functions.invoke('save-analysis')`), `deleteAnalysis`, `updateNote`. Loading/error state, optimistic delete + note updates.

## Save button — `src/components/chat/SaveAnalysisButton.tsx`

- Props: `{ analysis, source: 'app' }`.
- States: idle (Bookmark + "Save Analysis"), loading (spinner), saved (BookmarkCheck + "Saved", green, disabled), free (opens upgrade modal / routes to `/pricing`).
- Pre-checks saved status via cached hook list.
- Mounted in `src/pages/Chats.tsx` only when the assistant message contains a parsed `MATCH_SCORE`. Score persisted as `match × 10`.

## Page — `src/pages/SavedAnalyses.tsx` (route `/saved-analyses`, Protected + lazy)

- Header: title, subtitle, count, sort (Newest / Highest score), search by address/URL.
- Cards: source pill (App/Extension), saved date, three-dot menu (Add note / Delete), score circle (green ≥80, yellow ≥50, red <50 — mapping the existing Match Score thresholds to 0–100), up to 4 metric chips (Cap Rate, Cash-on-Cash, Net Cash Flow, DSCR), 3-line summary + Read more, footer (View Full Analysis dialog, Open Property, inline editable note).
- Dialog: full markdown summary, all metrics, score, editable note, Open URL, Delete.
- Empty state: Bookmark icon + copy + "Go to Chat" → `/chats`.
- Free state: header renders, body shows lock card + "Upgrade to Premium" → `/pricing`.

## Navigation & console

- Add "Saved Analyses" entry in `Navigation.tsx` (desktop + mobile drawer), between Chats and Calculators. Visible to all logged-in users (free sees gated state).
- `OverviewPanel.tsx`: add a Saved Analyses summary card with count + link.

## Chrome extension — `chrome-extension/popup.tsx`

- After a property-analysis response in `ChatScreen`, render Save button (dark `#1E2D3D`, matching brand).
- Reuses `homelens_session.access_token` from `chrome.storage.local`.
- POSTs to `${SUPABASE_URL}/functions/v1/save-analysis` with `source: 'extension'` and active tab URL/title.
- Success → inline "Analysis saved to your HomeLens account" + "View all saved analyses →" opens `https://homelensais.com/saved-analyses`.
- 403 → upgrade message linking to `/pricing`. 409 → "Already saved" + view-all link.
- No other extension logic touched.

## Memory updates

- Add new memory file documenting Saved Analyses (Premium feature, score scale 0–100, gated by MATCH_SCORE, app + extension sources).
- Update `mem://index.md` Core to clarify: "Saved **Analyses** is allowed and distinct from the removed Favorites/Saved Searches."

## Files to create

- `supabase/migrations/<ts>_saved_analyses.sql`
- `supabase/functions/save-analysis/index.ts`
- `src/hooks/useSavedAnalyses.ts`
- `src/components/chat/SaveAnalysisButton.tsx`
- `src/pages/SavedAnalyses.tsx`

## Files to edit (minimal)

- `src/App.tsx` — lazy route `/saved-analyses` under `ProtectedRoute`.
- `src/components/Navigation.tsx` — nav item (desktop + mobile).
- `src/pages/Chats.tsx` — render `<SaveAnalysisButton>` below assistant messages with MATCH_SCORE.
- `src/components/console/OverviewPanel.tsx` — Saved Analyses card.
- `chrome-extension/popup.tsx` — Save button + confirmation UI.
- `.lovable/memory/index.md` + new memory file.

## Out of scope

No changes to AI prompts, chat logic, UIBlock renderers, calculators, auth, other edge functions, Stripe, or new dependencies.