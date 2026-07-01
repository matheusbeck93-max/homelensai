# Public site restructure — Features mega menu, Solutions, dedicated pages

## Scope
Rebuild the public (logged-out) header and ship dedicated marketing pages. The authenticated in-app navigation stays exactly as it is — only visitors without a session see the new layout.

## New header (logged-out only)

Replaces `HomepageSectionNav` in `src/components/Navigation.tsx`. When `user` is null we render the new marketing menu; when logged in, the current app nav renders unchanged.

Items, left to right:

1. **Features** — mega menu (Radix `NavigationMenu`, wide panel)
2. **Solutions** — dropdown, 2 cards
3. **Pricing** — link to `/pricing`
4. **FAQ** — link to `/faq`
5. Right side keeps `Sign In` / `Sign Up`, theme toggle, install prompt

Mobile: `Sheet` drawer with collapsible Features/Solutions groups, then Pricing and FAQ links.

### Features mega menu (9 items — one per feature you listed)

Each row: icon + name + one-line description. Clicking navigates to the feature's own page.

| Feature | Route | Icon (lucide) |
|---|---|---|
| AI Chat | `/features/ai-chat` | MessageSquare |
| Buying Power Calculator | `/features/buying-power` | Calculator |
| Investor Brief | `/features/investor-brief` | TrendingUp |
| Investor Calculator | `/features/investor-calculator` | LineChart |
| Saved Analyses | `/features/saved-analyses` | BookmarkCheck |
| My Properties | `/features/my-properties` | Home |
| Set Preferences | `/features/preferences` | SlidersHorizontal |
| Property Analysis | `/features/property-analysis` | ScanSearch |
| Chrome Extension | `/features/chrome-extension` | Chrome |

Layout: 3-column grid inside the mega menu panel with a subtle promo tile on the right (Chrome extension featured, matching your request to "start with the chrome extension").

### Solutions dropdown (2 items)

| Item | Route | Icon |
|---|---|---|
| Buyer Plan | `/solutions/buyer` | Home |
| Investor Plan | `/solutions/investor` | Briefcase |

Each row: icon + title + short description.

## New pages

Under `src/pages/marketing/`:

- `FeatureLayout.tsx` — shared marketing shell (hero + screenshot section + benefits grid + secondary screenshot + FAQ tease + CTA to `/auth?mode=signup`). Uses semantic tokens from `index.css`.
- 9 feature pages, each importing `FeatureLayout` with unique copy, icon, and screenshot(s).
- `solutions/BuyerPlan.tsx` — hero, embedded MP4 video, benefits, pricing CTA.
- `solutions/InvestorPlan.tsx` — same structure with the investor video.
- `Faq.tsx` — dedicated FAQ page (move the existing homepage FAQ section content into this route).

Existing pages reused:
- `Pricing` (`/pricing`) — already exists.

Existing anchor aliases `/extension`, `/investors`, `/chat-preview`, `/plans`, `/faq` are **replaced**:
- `/faq` → new dedicated `Faq` page.
- `/extension` → redirect to `/features/chrome-extension`.
- `/investors` → redirect to `/solutions/investor`.
- `/chat-preview` → redirect to `/features/ai-chat`.
- `/plans` → redirect to `/pricing`.
- `HOMEPAGE_SECTIONS` constant deleted; `HomepageSectionNav` deleted.

## Screenshots — what I can supply vs. what I need from you

Real product screenshots (no generic mockups). I'll capture them with Playwright against the live preview once we're in build mode.

**I can capture (no auth required or accessible with the injected session):**
- AI Chat page (`/chats`) — chat interface
- Buying Power Calculator (`/calculators`) — public
- Investor Calculator (`/investor/calculator`) — auth, will use injected session
- Investor Brief (`/investor`) — auth
- My Properties (`/investor/properties`) — auth, empty state
- Saved Analyses (`/saved-analyses`) — auth
- Preferences (`/profile-setup`) — auth
- Property Analysis (`/property/:id`) — pick a real listing URL to load

**I will need from you:**
- Chrome Extension in action on a real Zillow listing (browser injection isn't reproducible via Playwright in-sandbox reliably). Two shots ideal: the injected "Analyze with HomeLens" button on a listing card and the extension popup with a MacroBadge.
- Buyer Plan hero shot if you want a specific persona/context screenshot beyond the Buying Power calculator.

If any auth-gated capture returns empty state, I'll flag it and ask you to send a populated shot.

## Videos

Two uploads: `BUYER_INTRO.mov`, `INVESTOR_INTRO.mov`. In build mode I will:
1. Re-encode each to H.264 MP4 (faststart, yuv420p) with ffmpeg for reliable web playback.
2. Upload each MP4 to Lovable Assets, write `.asset.json` pointers.
3. Embed with `<video autoPlay muted loop playsInline controls>` in a hero video frame on the respective plan page.

## Technical notes

- Uses shadcn `NavigationMenu` for Features/Solutions on desktop; `Sheet` collapsible groups on mobile.
- No color literals — feature icon accents use `text-primary` / semantic tokens defined in `index.css`.
- `Navigation.tsx` gains a boolean `showMarketingNav = !user && !isAuthedRoute` and renders the new menu instead of `HomepageSectionNav` when true. Everything under `showAppNav` (icons for logged-in users) is untouched.
- Sitemap (`public/sitemap.xml`) gets entries for `/features/*`, `/solutions/*`, `/faq`. Each new page sets `<title>` + meta description via a small `<Helmet>`-style effect or direct `document.title` update (matches project's current pattern).
- `App.tsx` route additions for all new pages, plus `Navigate` redirects for the retired anchor aliases.

## Files touched

New:
- `src/components/marketing/PublicNav.tsx`
- `src/components/marketing/FeaturesMegaMenu.tsx`
- `src/components/marketing/SolutionsMenu.tsx`
- `src/components/marketing/featureRegistry.ts` (single source of truth: icon, name, description, route, screenshots)
- `src/pages/marketing/FeatureLayout.tsx`
- `src/pages/marketing/features/*.tsx` (9 files)
- `src/pages/marketing/solutions/BuyerPlan.tsx`
- `src/pages/marketing/solutions/InvestorPlan.tsx`
- `src/pages/marketing/Faq.tsx`
- `src/assets/homelens-buyer-intro-v2.mp4.asset.json`, `src/assets/homelens-investor-intro.mp4.asset.json` (from your uploads)

Modified:
- `src/components/Navigation.tsx` (swap logged-out branch to `PublicNav`)
- `src/App.tsx` (routes + redirects)
- `public/sitemap.xml`

Deleted:
- `src/components/HomepageSectionNav.tsx`
