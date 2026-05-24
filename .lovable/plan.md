# Polish Extension Credit-Limit CTA

## Goal
Replace the plain "limit reached" text + raw button in the extension chat with a clean, branded CTA card. Fix the wrong pricing URL.

## Scope
**File:** `chrome-extension/popup.tsx` only. No backend, manifest, or other file changes.

## Changes

### 1. New `CreditsExhaustedCard` component
Rendered inside the assistant bubble when `msg.upgradeCta === true`.

- Soft card surface: light background (`#F4F7FB`), 1px border (`#E2E8F0`), 10px radius, 14px padding.
- Sparkles SVG icon (inline, brand color `#6B8DB5`) + title **"You've used today's AI credits"** (13px, weight 600, `#2C3E55`).
- Body (12px, `#52606D`): *"Upgrade to Buyer Plan or Investor Plan for unlimited analyses, or wait for tomorrow's reset."*
- Two stacked primary buttons (full width, 8px gap):
  - **"Upgrade to Buyer Plan — $9.97/mo"** — solid `#6B8DB5`, white text.
  - **"Upgrade to Investor Plan — $24.97/mo"** — solid `#2C3E55`, white text.
  - Both open `https://homelensai.com/pricing` in a new tab.
- Ghost link **"Maybe later"** (11px, `#94A3B8`) that closes the share menu / no-ops visually.

### 2. Wire into `MessageBubble`
Replace the existing `{msg.upgradeCta && (<button ...>Upgrade to Premium</button>)}` block (popup.tsx ~lines 608–625) with `<CreditsExhaustedCard />`. Keep `renderMarkdown(msg.content)` so the backend message still appears above the card (provides context like "You've reached your daily AI limit…").

### 3. Fix pricing URL
Change `https://homelens.ai/pricing` → `https://homelensai.com/pricing` in both places:
- The new `CreditsExhaustedCard` buttons.
- The existing `onUpgradeNeeded` handler at line 1213.

## Out of Scope
- No changes to `background.ts`, edge functions, RLS, or the 429/`limitReached` backend contract.
- No new manifest permissions.
- No changes to the existing "Save Analysis" or share-menu blocks.
