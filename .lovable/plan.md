## Goal
Replace the generic "Failed to send a request..." toast with a friendly dialog when the user has run out of daily AI credits, showing plan options and the reset time.

## Root cause recap
The `perplexity-chat` / `ai-chat` edge functions return `429 { error: 'ai_credits_exhausted', limitReached: true, message: ... }` when the free daily quota (100 credits) is depleted. The Supabase client throws a `FunctionsHttpError` whose `.message` is just `"Edge Function returned a non-2xx status code"` — that's what the user is seeing as a scary platform error.

## Changes

### 1. New component: `src/components/subscription/CreditsExhaustedDialog.tsx`
- Controlled `<Dialog>` (shadcn) with:
  - Title: "You've used today's AI credits"
  - Body: "Free plan includes 100 AI credits per day. Upgrade for unlimited access, or wait until **{resetTime}** for your daily reset."
  - `resetTime` = next UTC midnight rendered in the user's local timezone (`toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })`) plus a "(in 3h 12m)" countdown line.
  - Two CTAs:
    - Primary: **Upgrade to Premium — $4.97/mo** → navigates to `/pricing`
    - Secondary: **Maybe later** → closes dialog
  - Subtle footer link: "See all plans" → `/pricing`
- Uses semantic tokens only (no hardcoded colors).

### 2. Helper: `src/lib/edgeErrors.ts` (new)
- `parseEdgeError(error): Promise<{ status?: number; body?: any }>` — handles `FunctionsHttpError` by reading `error.context.response.clone().json()` safely, so the catch block can detect `body.limitReached === true` or `body.error === 'ai_credits_exhausted'`.

### 3. `src/pages/Chats.tsx`
- Add `creditsDialogOpen` state.
- In the existing `catch (error)` block (line ~466) and around the `excelErr` catch (line ~462) and the perplexity retry (line ~365):
  - Run `parseEdgeError(error)`.
  - If `status === 429` and `body.limitReached`: open `CreditsExhaustedDialog`, refresh `useAiCredits().refresh()`, and **skip the destructive toast**.
  - Otherwise, keep existing toast behavior.
- Render `<CreditsExhaustedDialog open={creditsDialogOpen} onOpenChange={setCreditsDialogOpen} />`.

### 4. Optional consistency (small)
Apply the same parse + dialog trigger to the Chrome extension popup is **out of scope** — extension already has its own upgrade button.

## Out of scope
- No edge function changes (the 429 contract is already correct).
- No changes to `useAiCredits`, pricing page, or subscription logic.
- No CORS work (already fixed, will ship on next publish).

## Files touched
- create `src/components/subscription/CreditsExhaustedDialog.tsx`
- create `src/lib/edgeErrors.ts`
- edit `src/pages/Chats.tsx`
