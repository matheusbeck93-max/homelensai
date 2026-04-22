---
name: Subscription tiers & shared daily limit
description: Free vs Premium plan limits and the shared 3/day AI quota enforced across app + Chrome extension
type: feature
---
Two tiers: Free ($0) and Premium ($4.97/mo). Free users get 3 AI analyses/day; Premium is unlimited.

The daily quota is **server-enforced** and **shared between the main app and the Chrome extension** via `profiles.daily_analysis_count` + `profiles.daily_analysis_last_reset`.

Backend enforcement points (all use `supabase/functions/_shared/dailyLimit.ts` → `enforceDailyLimit(req)`):
- `ai-analyze-property` (legacy inline check, equivalent behavior)
- `ai-chat`
- `perplexity-chat`

Behavior of `enforceDailyLimit`:
- No `Authorization` header → `401 { error: 'auth_required' }`, **no quota consumed**.
- Premium → allowed, no increment.
- Free under limit → increments and allows.
- Free at/over limit → `429 { limitReached: true, message }`.

Chrome extension (`chrome-extension/popup.tsx`):
- On `401` → "Please sign in to HomeLens to use the assistant."
- On `429 { limitReached: true }` → assistant bubble with **Upgrade to Premium** button → opens `https://homelensai.com/pricing`.
- No client-side counter; the extension only reacts to backend responses.
