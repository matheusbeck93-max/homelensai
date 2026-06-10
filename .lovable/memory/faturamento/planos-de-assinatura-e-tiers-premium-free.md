---
name: Subscription tiers & shared daily limit
description: Free vs Premium plan limits and the shared 3/day AI quota enforced across app + Chrome extension
type: feature
---
Two tiers: Free ($0) and Premium ($4.97/mo). Free users get 3 AI analyses/day; Premium is unlimited.

**Current status:**
- AI Credits (`_shared/aiCredits.ts` → `CREDITS_ENFORCED`): **ENABLED** (true). 100 credits/day for free, unlimited for premium.
- Daily analysis count (`_shared/dailyLimit.ts` → `LIMITS_ENABLED`): currently **false** (3/day legacy limit not enforced).

The daily quota is **server-enforced** and **shared between the main app and the Chrome extension** via `profiles.daily_analysis_count` + `profiles.daily_analysis_last_reset`.

Backend enforcement points (all use `supabase/functions/_shared/dailyLimit.ts` → `enforceDailyLimit(req)`):
- `ai-analyze-property` (legacy inline check, equivalent behavior)
- `ai-chat`
- `perplexity-chat`

Behavior of `enforceDailyLimit` when `LIMITS_ENABLED = true`:
- No `Authorization` header → `401 { error: 'auth_required' }`, **no quota consumed**.
- Premium → allowed, no increment.
- Free under limit → increments and allows.
- Free at/over limit → `429 { limitReached: true, message }`.

Chrome extension (`chrome-extension/popup.tsx`):
- On `401` → "Please sign in to HomeLens to use the assistant."
- On `429 { limitReached: true }` → assistant bubble with **Upgrade to Premium** button → opens `https://homelensai.com/pricing`.
- No client-side counter; the extension only reacts to backend responses.

**TODO when re-enabling:** also add a 429 handler in the main app chat (`src/pages/Chats.tsx`) showing a friendly "Daily limit reached — Upgrade to Premium" message with CTA to `/pricing`. The extension already has this; the app currently shows a generic toast.

## Budget caps include Perplexity

`perplexity-chat` participates in the same per-tier daily + monthly $ caps as the Lovable AI router (`ai-chat`). It calls `checkBudget` before each Perplexity API call (returning the standard `402 { error: "budget_exceeded" }` payload on overage) and writes one row per successful call to `ai_usage_log` via `_shared/ai/perplexityUsage.ts` (`model_id: "perplexity:<model>"`, `api_name: <model>`). The Usage page, Overview `UsageSummaryCard`, header chip, and `BudgetCapBlocker` all read from `ai_usage_log`, so Perplexity spend is now visible everywhere alongside Gateway/Sonnet/Gemini spend.

**Extension note:** the Chrome extension only ever dispatches to `ai-chat` (which today calls `google/gemini-2.5-flash` via the gateway, not Claude Sonnet). It does not call `perplexity-chat`, so this change does not affect extension behavior — but extension `ai-chat` calls were already counting against the cap.
