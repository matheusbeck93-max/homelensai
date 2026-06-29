# Next PR — #7: Close out Quota Lockdown + Verification

PR #6 (Feature Quota Leak Lockdown) landed the backend half: every chat edge function (`ai-chat`, `investor-chat`, `owned-property-chat`, `preferences-assistant`, `investor-brief`, `ai-analyze`) now intercepts `FeatureQuotaExceededError` and returns HTTP 402 with `code: "QUOTA_EXCEEDED"`. The frontend half and operational sign-off were not finished. PR #7 closes that loop.

## Scope

### 1. Frontend recognizes QUOTA_EXCEEDED (not just BUDGET_EXCEEDED)
- `src/lib/edgeErrors.ts` — extend `isCreditsExhausted` to match `code === "QUOTA_EXCEEDED"` and 402 status (today it only handles 429 / `ai_credits_exhausted`).
- `src/lib/ai/budgetCap.ts` — update `parseAndRecordBudget402` / `recordBudgetExceededFrom402` so a `QUOTA_EXCEEDED` 402 sets a **monthly** cap (not daily) and surfaces tier + feature from the payload. Today both codes get treated as a daily budget hit.

### 2. Wire upsell UI on every chat surface
- `src/components/console/PreferencesChat.tsx` — add `useBudgetCap` + `<BudgetCapBlocker surface="preferences_assistant" />` + disabled composer (parity with `PropertyChat.tsx`). This is the only chat surface still missing the blocker.
- `src/pages/Chats.tsx` — verify the main chat triggers `CreditsExhaustedDialog` **or** routes to `/pricing` on `QUOTA_EXCEEDED` (monthly), and keeps the daily reset dialog for `BUDGET_EXCEEDED`.
- `CreditsExhaustedDialog.tsx` — branch copy/CTA for monthly vs daily (today it hard-codes "daily" and "100 credits").

### 3. Investor brief + SSE paths
- Confirm `investor-brief` 402 surfaces in `useInvestorBrief` as a paywall (not a generic toast).
- Confirm `investor-chat` SSE `QUOTA_EXCEEDED` events trigger the blocker mid-stream in `streamClient.ts`.

### 4. 24h verification (sign-off gate)
- `/admin/ai-spend`: prompt-cache hit rate ≥ 70%, monthly quota counters incrementing per tier.
- Anthropic Console: direct SDK billing = $0 (confirms no remaining `rawGateway` bypass).
- Manual probe: set a test profile's `monthly_chat_count = 20` on Free → send a chat → expect blocker, not a fallback reply.

## Out of scope (defer)
- Top-up flow copy refresh for the monthly path.
- Per-feature analytics dashboard for QUOTA_EXCEEDED events.

## Technical notes
- 402 body shape standardized in PR #6: `{ error, code: "QUOTA_EXCEEDED" | "BUDGET_EXCEEDED", tier, feature, limit }`.
- `useBudgetCap` already exposes `capType: "daily" | "monthly"` and `<BudgetCapBlocker />` already renders the right copy — the missing piece is the parser feeding it.
- No DB migrations. No new edge functions.

Estimated work: ~half a day, mostly client-side.
