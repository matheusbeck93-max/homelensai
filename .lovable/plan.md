## Root cause (confirmed)

Checked your profile in the database:

- `subscription_status: free`
- `ai_credits_used_today: 105` (cap is **100** for free tier)
- `ai_credits_last_reset: 2026-05-22`

So `perplexity-chat` is correctly returning **HTTP 429 `ai_credits_exhausted`**. That is the "non-2xx" the toast is showing. Nothing is broken in the function itself — you literally hit today's free limit (the Whole Foods question would have been request #106).

There are two separate problems to fix.

---

## Problem 1 — UX: generic "Edge Function returned a non-2xx" toast instead of the upgrade dialog

`src/pages/Chats.tsx` already wires `parseEdgeError` + `isCreditsExhausted` to open `CreditsExhaustedDialog` on 429s, but the dialog isn't showing for you. Most likely `parseEdgeError` can't read `error.context` for this `FunctionsHttpError` (supabase-js v2.76 sometimes returns a body that's already consumed), so `isCreditsExhausted` returns false and we fall through to the generic toast.

**Fix:**
1. Harden `src/lib/edgeErrors.ts` so it also looks at `error.status`, `error.statusCode`, `error.name === 'FunctionsHttpError'`, and the error message string ("non-2xx status code") combined with any cached `error.context.status`. Treat status 429 OR a body containing `ai_credits_exhausted` / `limitReached: true` as exhausted.
2. In `Chats.tsx`, if `parsed.status` is unknown but `error.message` includes "non-2xx", do one extra fallback fetch directly to the function URL (with the same body and auth header) to read the JSON body, so the dialog can open reliably.
3. Make the toast for unknown errors more user-friendly: "Something went wrong reaching the assistant. Please try again." instead of the raw SDK string.

## Problem 2 — "HomeLens needs to answer that question" (credits)

You're locked out for the rest of today. There are three knobs; pick one (I'll wait for your choice before changing anything):

- **A. Reset your counter now** (one-time fix, no code change). Sets `ai_credits_used_today = 0` for your account so you can keep testing today. Other free users unaffected.
- **B. Raise the free daily cap** in `supabase/functions/_shared/aiCredits.ts` (`DAILY_FREE_CREDITS`) from 100 → e.g. 200 or 300. Applies to all free users.
- **C. Mark your own account as paid/unlimited** for testing (`subscription_status = 'paid'` on your profile). Cleanest for your own testing without changing product limits.

Default recommendation: **A + the UX fix in Problem 1.** That gets you unblocked now and prevents the next user from seeing the same confusing toast. We can revisit B/C later if free-tier limits are too tight in practice.

---

## Out of scope
- No changes to `perplexity-chat` itself (it's behaving correctly).
- No pricing/plan changes.
- No changes to other consumers of `parseEdgeError`.

## Verification
- After the UX fix, simulate a 429 (e.g. call `perplexity-chat` with `ai_credits_used_today` already at 105) → `CreditsExhaustedDialog` opens, no generic toast.
- After reset (option A): retry the Whole Foods question → assistant responds normally and `ai_credits_used_today` increments from 0.

Which credit option (A, B, or C) do you want for Problem 2?
