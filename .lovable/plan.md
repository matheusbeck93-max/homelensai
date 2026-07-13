# Fix Chrome extension: persistent per-tab chat + user messages retained

## Problem 1 — Chat resets when switching tabs or minimizing

The popup closes automatically whenever the user switches tabs, clicks outside, or minimizes the window (standard Chrome behavior — not fixable). Reopen must restore the exact conversation for that tab.

Today, per-tab state (`tabConvos`, `pendingByTab`) lives only in the service worker's in-memory `Map`s in `chrome-extension/background.ts`. MV3 service workers are evicted after ~30 seconds idle, so the maps are wiped and the popup starts fresh on the next open.

**Fix:** persist both maps to `chrome.storage.session` (per-browser-session storage that survives service-worker restarts and is cleared automatically when the browser closes). Keyed by tab id, so multiple tabs each keep their own conversation in parallel.

## Problem 2 — User's messages disappear after sending

In `chrome-extension/popup.tsx`, `sendMessage` calls `setMessages([...messages, userMsg])` and then immediately calls `callAiChat(...)`, which calls `dispatchToBackground('ai-chat', body, messages)` — but `messages` here is the **stale** closure value (React hasn't flushed the update yet), so the snapshot sent to the background does NOT include the just-typed user message.

Background stores that stale snapshot into `convo.messages`, later appends the assistant reply, and broadcasts `AI_REQUEST_COMPLETE`. The popup then calls `syncFromTabConvo`, which does `setMessages(state.messages)` — overwriting local state with `[…old, assistant]`. The user message is lost from the UI (and from the persisted convo).

**Fix:** thread the fresh post-append snapshot through `sendMessage` → `callAiChat` → `dispatchToBackground` so the background caches the correct history including the user turn.

## Changes

### `chrome-extension/background.ts`
1. Replace the in-memory `Map`s with a thin wrapper backed by `chrome.storage.session`:
   - Key format: `convo:<tabId>` → `TabConvoState`, `pending:<tabId>` → `PendingRequest`.
   - Small in-memory read-through cache (rebuilt on cold start by lazily reading `chrome.storage.session` when a `GET_TAB_CONVO` / `GET_PENDING_REQUEST` arrives).
   - Every mutation writes through to `chrome.storage.session.set` / `.remove`.
2. On SW startup, warm the cache with `chrome.storage.session.get(null)`.
3. Keep the existing `tabs.onRemoved` handler — extend it to also delete both storage keys for that tab (so closing the tab still ends the conversation, per user requirement).
4. Keep `tabs.onUpdated` URL-drift cleanup, but also mirror the delete into storage.
5. Do NOT clear anything on `tabs.onActivated`, popup close, or SW eviction — those are exactly the events we want to survive.

### `chrome-extension/popup.tsx`
1. In `sendMessage`, compute `updatedMessages` (already done) and pass it forward:
   - Change `callAiChat` signature to accept `snapshotIncludingUser: Message[]` and forward to `dispatchToBackground`.
   - Update all `callAiChat` callers (`sendMessage`, `handleAnalyzeNow`) to pass the correct snapshot that already includes the appended user message.
2. In `dispatchToBackground`, keep the `messagesSnapshot` handoff — it will now contain the user turn, so background's `convo.messages = snapshot` writes the right thing and the later `syncFromTabConvo` restores the user message correctly.
3. No other UI/logic changes.

## Out of scope

- No changes to auth/session refresh, save-chat flow, listing detection, or any UI styling.
- No new permissions (`storage` is already declared in `manifest.json`; `chrome.storage.session` is part of the existing `storage` permission).
- No changes to the main web app.

## Verification

1. Open extension on tab A, chat a few turns → switch to tab B → return to tab A → open popup: full conversation still there, including user messages.
2. Open extension on tabs A and B with different sites: each has its own independent conversation.
3. Minimize the browser for >1 minute (SW gets evicted), restore, reopen popup: conversation still there.
4. Close the specific tab: conversation for that tab is gone (as required).
5. Close the entire browser and reopen: all extension conversations are cleared (session storage semantics).
6. Send a message: user bubble stays visible while the assistant is thinking and after the reply arrives.
