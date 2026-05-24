## Chrome Extension Credit-Limit CTA — Plan

Scope: `chrome-extension/popup.tsx` only. No backend, manifest, or other file changes.

## Findings

**Limits match the app.** The extension calls `ai-chat` and `perplexity-chat`, both of which run through `supabase/functions/_shared/aiCredits.ts` — the same shared enforcer the web app uses (100 AI credits/day free, unlimited paid tiers). When exhausted, it returns `429 { error: 'ai_credits_exhausted', limitReached: true, message: "You've reached your daily AI limit..." }`. The quota is already shared and server-enforced — no backend changes needed.

**CTA exists but is rough.** In `chrome-extension/popup.tsx`, both `callPerplexityChat` and `callAiChat` already catch `429 + limitReached` and append an assistant bubble with `upgradeCta: true`, which `MessageBubble` renders as a single flat blue "Upgrade to Premium" button under the text. Two issues:

1. The button opens `https://homelens.ai/pricing` — wrong domain. Live site is `https://homelensai.com/pricing`.
2. It reads as a plain error sentence + raw button, not a designed CTA.

## Plan

### 1. New inline component `CreditsExhaustedCard`
A self-contained card rendered inside the assistant bubble when `msg.upgradeCta === true`, replacing the current plain text + button combo:

- Soft card surface (light background, 1px border, 10px radius, 14px padding) inside the existing assistant bubble — clearly a CTA, not an error.
- Small sparkles SVG icon in a tinted circle (uses the existing brand color `#6B8DB5`).
- Title: **"You've used today's AI credits"**
- Body: "Upgrade to Buyer Plan or Investor Plan for unlimited analyses, or wait for tomorrow's reset."
- Subtle reset hint line with a clock glyph: "Credits reset at {local time of next UTC midnight}".
- Two primary buttons stacked:
  - **"Upgrade to Buyer Plan — $9.97/mo"** → opens `https://homelensai.com/pricing` in a new tab.
  - **"Upgrade to Investor Plan — $24.97/mo"** → opens `https://homelensai.com/pricing` in a new tab.
- Secondary ghost link: **"Maybe later"** → dismisses the card (local state only; message stays in history without the CTA).

Styling matches the rest of the extension (inline styles, brand `#6B8DB5`, no new deps).

### 2. Wire into `MessageBubble`
Replace the existing `{msg.upgradeCta && (...)}` block with `<CreditsExhaustedCard />`. Keep the message bubble itself; only the inline button is swapped for the card. Markdown rendering of `msg.content` is preserved, but for `upgradeCta` messages we'll hide the raw sentence (the card carries the copy) to avoid duplication.

### 3. Fix the pricing URL
Change `https://homelens.ai/pricing` → `https://homelensai.com/pricing` (the live custom domain). This affects both the new CTA card and the existing `onUpgradeNeeded` handler (Save-analysis upsell). Same domain fix.

### 4. Keep current backend contract
- Still triggered by `429 + limitReached` from `ai-chat` / `perplexity-chat`.
- No changes to `background.ts`, manifest, edge functions, or DB.
- No new permissions.

### Files touched
- `chrome-extension/popup.tsx` — add `CreditsExhaustedCard`, swap the inline button, fix pricing URLs.

### Out of scope
- No changes to credit accounting, daily reset logic, or the app's `CreditsExhaustedDialog`.
- No new translations, telemetry, or analytics.