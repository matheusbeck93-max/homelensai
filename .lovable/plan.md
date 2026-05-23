## Problem

The "Something went wrong reaching the assistant" toast is caused by the `preferences-assistant` edge function returning a non-2xx response. Logs show:

```
AI gateway 429: {"type":"rate_limited","message":"A lot of free users are using the API and you're being rate limited..."}
```

Two contributing factors:
1. Every user turn currently makes **two** AI Gateway calls (Pass 1 extract, Pass 2 reply), doubling rate-limit pressure.
2. When the gateway returns 429, the function bubbles the error up, the client toasts a generic message, and the user's preferences pane doesn't update.

## Fix

### 1. Graceful 429/402 handling in `supabase/functions/preferences-assistant/index.ts`
- Wrap both `extractPatch` and `generateReply` so that if `callAiGateway` returns `{ error }` (already-handled 429/402), we:
  - Still persist any structured patch we managed to extract (Pass 1 may have succeeded even if Pass 2 failed).
  - Return a **200** JSON payload with `{ message: "I'm getting rate-limited right now — please try again in a few seconds. Your preferences are saved.", preferences, suggested_replies: [] }` instead of a 5xx.
  - Include a `rate_limited: true` flag so the client can style differently if desired.
- If Pass 1 itself 429s, return 200 with the same friendly message and the unchanged preferences.

### 2. Collapse to a single AI call on the happy path
- Replace the two-pass design with **one** gateway call that exposes both tools (`update_preferences` and `reply`) and uses `tool_choice: "auto"`, letting the model emit both tool calls in one response when needed (Gemini supports parallel tool calls).
- Keep the existing extraction lexicon/rules in the system prompt; merge the reply-prompt rules ("never re-ask filled fields", "ack diff briefly") into the same system prompt.
- Apply any returned `update_preferences` patch first, then use the `reply` tool's `{message, suggested_replies}` as the response. If only one tool fires, fall back: missing reply → synthesize a short ack from the diff; missing patch → skip patching.
- Net effect: ~50% fewer gateway requests per user turn, sharply reducing 429 frequency.

### 3. Client UX polish in `src/components/console/PreferencesChat.tsx`
- When the edge function returns `rate_limited: true` (200 response), render the message inline as a normal assistant turn instead of showing the destructive "Chat error" toast.
- Keep the existing destructive toast only for true errors (network failure, non-200 from the function).

### Technical notes

- No DB schema, route, or auth changes.
- No changes to `PreferencesSummaryCard`, `PreferencesEditDialog`, save/reset/restart/edit flows — those already work.
- Single edge function edit + single component edit.

### Files touched
- `supabase/functions/preferences-assistant/index.ts` (collapse to single call, graceful 429)
- `src/components/console/PreferencesChat.tsx` (handle `rate_limited` response without destructive toast)
