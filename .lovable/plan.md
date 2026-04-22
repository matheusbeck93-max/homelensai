

## Goal
Make the Chrome extension respect the **same daily limit the app already enforces** (3 AI analyses/day for free users, unlimited for premium). Counter is shared between app and extension via the existing `profiles.daily_analysis_count` column. Premium users unaffected.

> Note: Lovable's internal guidance discourages adding new backend rate-limiting because there are no shared primitives yet. Since you explicitly requested it and a counter already exists in `profiles`, I'll **reuse the existing pattern** rather than introduce a new `usage_tracking` table. This keeps the implementation ad-hoc but consistent with what the app does today.

## Where the limit lives today

- **Already in backend**: `supabase/functions/ai-analyze-property/index.ts` checks `profiles.daily_analysis_count` and returns `429 { limitReached: true }` when free users hit 3/day. ✅
- **Only in frontend (bypassable)**: `src/lib/useRateLimit.ts` (localStorage). Used for featured homes / search throttling — UX-only, kept as-is.
- **No limit at all**: `ai-chat` and `perplexity-chat` (the two endpoints the extension actually calls).

## Plan

### 1. Backend — add the same limit to `ai-chat` and `perplexity-chat`

Reuse the existing `profiles.daily_analysis_count` + `daily_analysis_last_reset` columns (no new table, no new schema). Both functions will:

1. Read `Authorization` header → resolve `user.id` via `_shared/auth.ts` (`getAuthenticatedUserProfile`).
2. Read `subscription_status` from `profiles`. If `premium` → skip limit.
3. If free: reset count if `daily_analysis_last_reset` ≠ today, then check `daily_analysis_count >= 3` → return `429 { error, message, limitReached: true }` with the **same message the app uses**.
4. If allowed: increment `daily_analysis_count` and proceed.
5. Unauthenticated requests on the extension path → return `401 { error: 'auth_required' }` (does not consume a quota slot).

The check is **placed at the top** of each handler, before any AI call. Existing behavior for authenticated app callers is identical to today's `ai-analyze-property` behavior.

The client-supplied `userTier` field continues to be accepted in `ai-analyze-property` for backward compatibility, but the new checks in `ai-chat`/`perplexity-chat` derive tier server-side only — the extension cannot spoof it.

### 2. Chrome extension — surface the 429 + login states

Edit `chrome-extension/popup.tsx` only:

- After `fetch` to `ai-chat` and `perplexity-chat`, if `res.status === 401` → show "Please sign in to HomeLens to use the assistant." with link to login screen (already exists).
- If `res.status === 429` and body has `limitReached: true` → render an inline assistant message:
  > "You've reached your daily limit for this feature. Upgrade to Premium for unlimited access."
  with an **Upgrade** button that opens `https://homelensai.com/pricing` in a new tab.
- No client-side counter inside the extension. It only reacts to backend responses.

No changes to `chrome-extension/background.ts`, `manifest.json`, or build config.

### 3. App principal — zero changes

- `useRateLimit.ts` untouched.
- `ai-analyze-property` behavior unchanged.
- All existing UI, toasts, and limit messages unchanged.

## Out of scope

- New `usage_tracking` table. Not needed; the existing `profiles.daily_analysis_count` already serves as the shared counter and is what the app reads/writes today. Adding a parallel table would create two sources of truth.
- Splitting `app` vs `extension` source tracking. Not requested for behavior; can be added later as a `source` column if you want analytics.
- Touching any other edge function (`ai-search`, `compare-properties`, etc.) — out of the extension's call surface.

## Validation

After deploy, test in this order:

1. **Free user, 1st extension chat** → works.
2. **Free user, 4th request of the day from the extension** (after 3 in the app) → 429 + upgrade message in popup.
3. **Free user, 4th request from the app** (after 3 in the extension) → existing app limit-reached toast fires (counter is shared).
4. **Premium user** → unlimited in both surfaces.
5. **Logged-out extension user** → "Please sign in" prompt; no counter consumed.
6. **App users (non-extension)** → behavior unchanged; daily counter still increments only on AI analyses as before.

## Files touched

- `supabase/functions/ai-chat/index.ts` — add auth + limit gate at top of handler.
- `supabase/functions/perplexity-chat/index.ts` — same gate.
- `chrome-extension/popup.tsx` — handle 401 / 429 responses with friendly UI + Upgrade CTA.
- Memory: add note in `mem://faturamento/planos-de-assinatura-e-tiers-premium-free` that the daily 3-analysis limit is also enforced by `ai-chat` and `perplexity-chat` and shared with the extension.

