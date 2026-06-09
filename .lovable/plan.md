# Persist extension chat + keep requests running on popup close

## Problem

The Chrome extension popup is destroyed every time it loses focus (Chrome standard behavior). Today this causes two visible bugs:

1. **Conversation resets** when the user switches windows and reopens the popup, because the popup re-mounts from scratch and re-reads only the auth/property context — message state lives in React component memory.
2. **In-flight AI requests are aborted** when the popup closes mid-stream, because the `fetch()` to `ai-chat` is owned by the popup window.

`background.ts` already has the right scaffolding for fix #1 — a `tabConvos: Map<tabId, TabConvoState>` cache with `GET_TAB_CONVO` / `SET_TAB_CONVO` / `CLEAR_TAB_CONVO` messages, and a `tabs.onUpdated` listener that clears the entry only on URL change. But the popup does not actually persist its `messages` array into it on every turn, and there is no concept of an in-flight request that survives popup close.

Persistence scope stays as today's spec: **until URL changes or tab closes** (in-memory only on the service worker).

## Changes

### 1. Background service worker owns the AI request (`chrome-extension/background.ts`)

Add a per-tab in-flight request store and message handlers:

```ts
interface PendingRequest {
  id: string;          // crypto.randomUUID()
  tabId: number;
  url: string;         // page URL request belongs to; drop if tab navigates
  startedAt: number;
  status: 'pending' | 'done' | 'error';
  result?: { content: string; matchScore?: number | null };
  error?: { message: string; budgetCap?: any };
}

const pendingByTab = new Map<number, PendingRequest>();
```

New message types:

- `START_AI_REQUEST` — `{ tabId, url, endpoint, body, authHeader }`. Background does the `fetch`, awaits the JSON, on success appends the assistant message to `tabConvos.get(tabId).messages` and stores the result on `pendingByTab`. Returns `{ ok: true, requestId }` synchronously so the popup can correlate.
- `GET_PENDING_REQUEST` — `{ tabId }` → returns the current `PendingRequest` for that tab (or null). Used on popup mount to detect "a response is still cooking".
- `CLEAR_PENDING_REQUEST` — `{ tabId, requestId }` — called by popup after it consumes a `done`/`error` result so the next turn starts clean.
- Broadcast a `runtime.sendMessage({ type: 'AI_REQUEST_COMPLETE', tabId, requestId })` when the fetch resolves so an open popup updates immediately instead of polling.

URL drift handling: in the existing `tabs.onUpdated` URL-change branch, also drop any `pendingByTab` entry whose `url` no longer matches — matches the "Until URL changes or tab closes" persistence rule. Same for `tabs.onRemoved`.

### 2. Popup delegates the fetch and re-hydrates on mount (`chrome-extension/popup.tsx`)

Today the popup builds the request body, calls `fetch(...)` itself, then updates React state. Refactor the AI-call helper to:

1. Compute `endpoint`, `body`, `Authorization` header as today.
2. Send `START_AI_REQUEST` to background; receive `requestId`.
3. Show the existing typing indicator. Listen for `AI_REQUEST_COMPLETE` (or poll `GET_PENDING_REQUEST` once per second as a fallback) for this `requestId`.
4. When it resolves, read the assistant message from `tabConvos` (background already appended it), update React state, call `CLEAR_PENDING_REQUEST`.

On popup mount (existing `useEffect` that calls `GET_TAB_CONVO`):

- After restoring `messages`, `scrollTop`, `draftInput`, also call `GET_PENDING_REQUEST`. If one exists:
  - Status `pending` → show typing indicator and subscribe as above.
  - Status `done` → pull the assistant message out of `tabConvos` (already appended by background), render it, call `CLEAR_PENDING_REQUEST`.
  - Status `error` → render the existing error UI (including `budgetCap` path), call `CLEAR_PENDING_REQUEST`.

### 3. Persist messages on every turn, not only on unmount

Audit the existing `SET_TAB_CONVO` calls. Today the popup writes back on some transitions but the bug suggests at least one path (user-sent message → assistant reply) does not persist before the popup can be closed. Make it idempotent: after **any** mutation to `messages`, `scrollTop`, or `draftInput`, send `SET_TAB_CONVO` with the latest snapshot. Easiest pattern is a `useEffect([messages, draftInput])` that debounces a single `SET_TAB_CONVO` call.

### 4. No changes to edge functions, auth, or detection

This is purely an extension-side refactor. `ai-chat` keeps the same contract. Auth refresh in `refreshAccessTokenIfNeeded` runs in the popup before `START_AI_REQUEST` so the background gets a fresh `Authorization` header.

## Out of scope

- Streaming the response progressively into the popup (we still wait for the full JSON, just in the background instead of the popup). Streaming would require a different architecture and is not needed for this bug.
- Persisting beyond URL change / tab close. Existing spec is preserved.
- Touching the website chat — those conversations already survive because they live on a real page, not a popup.

## Acceptance checks

1. Open extension on a Zillow listing, send a message, wait for reply, switch to another window, switch back → full conversation still visible, scroll position preserved.
2. Open extension, send a message, immediately switch to another window before the reply arrives, wait ~10s, switch back → reply is already there (or typing indicator still showing if not yet done), no duplicate request was fired.
3. Send a message, close popup, navigate the tab to a different URL → on next open, conversation is cleared (matches "Until URL changes" rule).
4. Send a message that triggers a `budget_exceeded` 402 while popup is closed → reopening shows the existing CreditsExhaustedCard UI, not a silent failure.
5. Bump `chrome-extension/manifest.json` patch version (→ 1.0.4) and rebuild before zipping for the Web Store.

## Files touched

- `chrome-extension/background.ts` — add `pendingByTab`, three new message handlers, completion broadcast, URL-drift cleanup.
- `chrome-extension/popup.tsx` — replace inline `fetch` with `START_AI_REQUEST` round-trip; add pending-request rehydration in the mount effect; add debounced `SET_TAB_CONVO` persistence effect.
- `chrome-extension/manifest.json` — version bump to `1.0.4`.
