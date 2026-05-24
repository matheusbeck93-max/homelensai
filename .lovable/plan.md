## Chrome Extension Updates — Plan

Scope: `chrome-extension/popup.tsx` and `chrome-extension/background.ts` only. No app, manifest, or other file changes.

### Important constraint to flag up-front

Chrome MV3 toolbar popups (`chrome.action.default_popup`) **cannot be repositioned** — Chrome always anchors them under the toolbar icon. To make the chat "open in the same position as the Analyze with HomeLens button on the page", the only viable approach is to render the chat as a **floating panel injected into the page DOM** (anchored to the floating button), instead of the toolbar popup.

Since the user restricted edits to `popup.tsx` and `background.ts` (not `content.ts` or `manifest.json`), I need to confirm the approach before building. Two viable options:

- **Option A (recommended):** Reuse the existing `popup.tsx` React app, but mount it from `content.ts` into a Shadow DOM container anchored at the floating button's position. This requires a small edit to `content.ts` to host the panel. *Strictly speaking this touches one extra file beyond the two you listed, but it is the only way to satisfy requirement #1.*
- **Option B:** Keep the toolbar popup as-is (always opens under the toolbar icon) and ignore the "same position as floating button" requirement. Apply the other three requirements (auth gate, persistent login, per-tab conversation) inside `popup.tsx` + `background.ts` only.

**Question for you before I implement:** which option do you want? I'll assume Option A for the rest of the plan since it matches the stated UX; tell me if you'd rather have Option B.

---

### 1. Chat panel positioning (Option A)

- `content.ts` (existing floating-button injector) gains a second responsibility: when the user clicks the floating "Analyze with HomeLens" button, instead of asking the background to open the toolbar popup, mount a Shadow-DOM container at the button's bounding rect (`getBoundingClientRect`) and load the same React app currently in `popup.tsx`.
- `popup.tsx` is refactored so its root component (`<App />`) can be mounted into either:
  - the existing `#root` div in `popup.html` (fallback when no listing detected — toolbar popup, default bottom-right behavior as today), or
  - the Shadow-DOM container created by `content.ts` (anchored to the floating button).
- Anchor logic: position the panel so its bottom-right corner aligns with the button's top-right corner; if it would overflow viewport, flip to a safe side. When no button is present on the page, the user falls back to clicking the toolbar icon → standard popup (bottom-right of toolbar = default).

### 2. Authentication gate (`popup.tsx`)

- On every mount, read `chrome.storage.local.homelens_session`.
- If no session, or refresh fails, render `<LoginScreen />` (already exists). Add a secondary "Create Account" button that opens `https://homelensai.com/auth` in a new tab via `chrome.tabs.create`.
- Block all chat/analysis UI until authenticated. Do not auto-open any external tab on launch.

### 3. Persistent login

- `LoginScreen` already saves `{ access_token, refresh_token, expires_at, email, user_id }` to `chrome.storage.local.homelens_session` — keep as is.
- `refreshAccessTokenIfNeeded()` already exists; ensure it runs once on mount before deciding auth state. If refresh fails → show login.
- Add an explicit **Logout** control in the extension's settings/header menu that calls `chrome.storage.local.remove('homelens_session')` and resets in-memory state.

### 4. Per-tab conversation persistence

- Introduce a background-worker in-memory map: `Map<tabId, { url, messages, scrollTop, draftInput }>` in `background.ts`. Not persisted to storage.
- `popup.tsx` (or injected panel) on mount:
  1. Resolve current `tabId` and `url` via `chrome.tabs.query({active:true, currentWindow:true})`.
  2. Ask background for cached state for that tab (`chrome.runtime.sendMessage({type:'GET_TAB_CONVO', tabId})`).
  3. If `cached.url === currentUrl` → restore messages, scroll position, draft input.
  4. Otherwise → start fresh.
- On every message send / input change / scroll, debounce-push state to background (`SET_TAB_CONVO`).
- `background.ts` listens to `chrome.tabs.onUpdated` — when a tab's `url` changes, delete that tab's entry. Also clear on `chrome.tabs.onRemoved`.
- "New Conversation" button in the UI sends `CLEAR_TAB_CONVO` for the current tab and resets local React state regardless of URL.
- Because the service worker can be evicted, the map is best-effort in-memory; eviction = fresh conversation, which is acceptable per spec ("in-memory per tab only").

### What stays untouched

- No app code outside `chrome-extension/`.
- `manifest.json` permissions unchanged (already has `activeTab`, `storage`, `tabs` access via host_permissions).
- No Supabase persistence of conversation history.
- No forced reloads.

### Files that will change

- `chrome-extension/popup.tsx` — refactor mount, add logout, integrate background conversation cache, add "Create Account" CTA.
- `chrome-extension/background.ts` — add in-memory per-tab conversation map + message handlers + `tabs.onUpdated` URL-change reset.
- `chrome-extension/content.ts` — *only under Option A*: mount the React panel anchored to the floating button (Shadow DOM).

Confirm Option A vs B and I'll implement.