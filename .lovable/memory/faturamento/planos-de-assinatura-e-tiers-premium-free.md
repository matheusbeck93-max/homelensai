---
name: Subscription tiers & shared daily limit
description: Free vs Premium plan limits and the shared 3/day AI quota enforced across app + Chrome extension
type: feature
---
Two tiers: Free ($0) and Premium ($4.97/mo). Free users get 3 AI analyses/day; Premium is unlimited.

**Current status: limits TEMPORARILY DISABLED** during testing period.
Master switch lives in `supabase/functions/_shared/dailyLimit.ts` → `const LIMITS_ENABLED = false`.
Flip to `true` to re-enforce — no other code change needed. Frontend/extension already handle 401 and 429 responses (including the Premium upgrade CTA).

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
