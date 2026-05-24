## Fix wrong URLs in Chrome extension

The correct domain is `homelensais.com`. Several places still reference `homelens.ai` or `homelensai.com`.

### Changes in `chrome-extension/popup.tsx`
- Line 299: share text footer `homelens.ai` → `homelensais.com`
- Line 586: "Create Account" → `https://homelensais.com/auth` (currently `homelensai.com/auth`)
- Line 593: "Open HomeLens" link → `https://homelensais.com`
- Line 696: Saved analyses link → `https://homelensais.com/saved-analyses`
- Line 1215: Profile link → `https://homelensais.com/profile`

### Changes in `chrome-extension/content.ts`
- Line 73: Fallback open URL → `https://homelensais.com/chats?url=...`
- Line 149: Hostname guard — add `homelensais.com` to the skip list (keep old `homelens.ai` entries as safety in case old domain still loads)

### Changes in `chrome-extension/manifest.json`
- Lines 39–40: Add `https://homelensais.com/*` and `https://*.homelensais.com/*` to host permissions (keep existing entries for backward compatibility, or replace — will replace since the correct domain is `homelensais.com`).

### Out of scope
No backend, no UI redesign, no other files.
