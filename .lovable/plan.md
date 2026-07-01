# Footer restructure + dropdown hover polish

## 1. Footer: mirror header structure (`src/components/Footer.tsx`)

Replace the current 4-column layout (Product / Company / Resources / Legal) with 4 columns that mirror the public header:

**Features** (text-only links, no icons, one per line, in this exact order)
- Chrome Extension → `/features/chrome-extension`
- AI Chat → `/features/ai-chat`
- Buying Power Calculator → `/features/buying-power`
- Calculators → `/features/calculators`
- Investor Brief → `/features/investor-brief`
- Investor Calculator → `/features/investor-calculator`
- Saved Analyses → `/features/saved-analyses`
- My Properties → `/features/my-properties`
- Set Preferences → `/features/preferences`
- Property Analysis → `/features/property-analysis`

(Slugs will be verified against `FEATURES_BY_SLUG` in `src/components/marketing/featureRegistry.tsx` before writing; any missing slug gets flagged, not silently linked.)

**Solutions** (text-only)
- Buyer Plan → `/solutions/buyer`
- Investor Plan → `/solutions/investor`

**Company** — unchanged (Blog, FAQ, Support mailto).

**Legal** — unchanged (Terms, Privacy, Cookies, Fair Housing, Accessibility, CCPA, DMCA, Do Not Sell).

Simplify `FooterLinkItem` to drop the icon branch for these columns. Keep the logo block, brand tagline, bottom Security & Privacy chip, and copyright exactly as-is. Responsive grid becomes `grid-cols-1 md:grid-cols-2 lg:grid-cols-5` (1 brand col + 4 link cols) so the taller Features list stays scannable on tablets.

## 2. Dropdown hover contrast (`src/components/marketing/PublicNav.tsx`)

Current issue: `hover:bg-accent hover:text-accent-foreground` leaves the muted description and the primary-tinted icon badge low-contrast against the accent background.

Fix on each `<Link>` inside the Features and Solutions mega-menus, using a `group` pattern so children respond to the parent hover:
- Link wrapper: add `group` alongside existing hover classes.
- Title `<span>`: already inherits `accent-foreground` — keep.
- Description `<span>`: change `text-muted-foreground` to also include `group-hover:text-accent-foreground/90` so the description lifts to a WCAG-AA contrast level on hover/focus.
- Icon badge: swap `bg-primary/10 text-primary` to also include `group-hover:bg-primary group-hover:text-primary-foreground` so the icon stays clearly visible on the accent background.
- Mirror the same treatment on keyboard focus (`focus:` variants already present via `focus:bg-accent`) by using `group-focus:` equivalents.

No layout, spacing, animation, or structural changes — visual states only.

## Verification
- Build passes.
- Playwright screenshot of `/` footer at desktop + mobile widths.
- Playwright hover screenshot of Features and Solutions mega-menus to confirm title, description, and icon all remain readable.
