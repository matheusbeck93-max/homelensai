

# Plan: Multi-value Preferences + "About You" Field + Chrome Extension Share Button

## Summary
Three changes: (1) Allow multiple cities/states, buyer personas, investment strategies, financing preferences, and must-have features via dynamic `(+)` add buttons in Account Preferences. (2) Add a free-text "What should I know about you?" field persisted to profiles. (3) Add a Share button to the Chrome extension for sharing AI outputs via SMS, WhatsApp, X, Facebook, etc.

---

## 1. Database Migration

Add one new column to `profiles`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS about_me text;
```

The existing columns already support arrays for `must_have_features` and `children_ages`. For multi-city/state, we'll use the existing `preferred_cities` (text[]) column. For multi-persona, we'll store as a text[] in a new column. Same for investment strategies and financing preferences.

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buyer_types text[],
  ADD COLUMN IF NOT EXISTS investment_strategies text[],
  ADD COLUMN IF NOT EXISTS financing_preferences text[];
```

Total: 4 new nullable columns. No RLS changes needed.

---

## 2. `AccountPreferencesPanel.tsx` — Multi-value fields + "About You"

**Cities/States**: Replace single city/state inputs with a dynamic list. Each entry is a `{city, state}` pair. A `(+)` button adds a new empty row. An `(×)` button removes a row. Save to `preferred_cities` as `["Austin, TX", "Miami, FL"]`.

**Buyer Persona**: Replace single Select with a list of selects. `(+)` adds another persona. Save to `buyer_types` (text[]).

**Investment Strategy & Financing Preference**: Same pattern — replace single Select with dynamic list using `(+)` to add more. Save to `investment_strategies` and `financing_preferences` (text[]).

**Must-Have Features**: Already supports multiple via checkboxes. Add a text input + `(+)` button to let users type custom features beyond the preset list.

**"What should I know about you?"**: New card at the bottom (before Appearance), with a Textarea. Save to `about_me`.

**All fields remain optional** except Full Name and Email (contact info).

**handleSave**: Update to persist all new array fields and `about_me`.

---

## 3. `ai-chat/index.ts` & `perplexity-chat/index.ts` — Inject new fields

Extend the personalization context to include `about_me`, `buyer_types`, `investment_strategies`, `financing_preferences`, and `preferred_cities` array values so the AI has full context.

---

## 4. Chrome Extension Share Button (`popup.tsx` + `popup.css`)

**Share Icon**: Add an SVG share icon component.

**Per-message share**: Add a small share button on each assistant message bubble. On click, open a share menu with options:
- **Copy to clipboard** — copies the message text
- **WhatsApp** — `https://wa.me/?text={encoded}`
- **SMS** — `sms:?body={encoded}`
- **X (Twitter)** — `https://twitter.com/intent/tweet?text={encoded}`
- **Facebook** — `https://www.facebook.com/sharer/sharer.php?quote={encoded}`
- **Email** — `mailto:?subject=HomeLens Analysis&body={encoded}`
- **Native Share API** — if available (mobile browsers)

The share menu appears as a small dropdown/popover anchored to the share icon. Each option opens in a new tab via `window.open` or `chrome.tabs.create`.

The shared text will be prefixed with "🏡 HomeLens AI Analysis:\n\n" + message content + "\n\nAnalyzed with HomeLens — homelens.ai"

**CSS**: Add styles for `.hl-share-btn`, `.hl-share-menu`, `.hl-share-option`.

---

## Files Changed

| File | Change |
|---|---|
| DB migration | Add 4 columns: `about_me`, `buyer_types`, `investment_strategies`, `financing_preferences` |
| `AccountPreferencesPanel.tsx` | Multi-value (+) pattern for cities, personas, strategies, financing, custom features; "About You" textarea |
| `ai-chat/index.ts` | Inject new array fields + `about_me` into personalization context |
| `perplexity-chat/index.ts` | Inject new fields into profile context |
| `chrome-extension/popup.tsx` | Share button per assistant message with share menu |
| `chrome-extension/popup.css` | Styles for share UI |

