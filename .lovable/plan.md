# HomeLens Full Features Promo — 9:16 Vertical Video

A new ~30s vertical (1080x1920) Remotion video introducing HomeLens and walking through every feature/section shown on the homepage (per the attached reference screenshot).

## Reference mapping (from homepage screenshot)
1. Hero: "Meet Your Real Estate Advisor" + search bar + "Big decisions deserve the full picture"
2. Four top capability cards: Market Intelligence Search · Property Analysis · Compare Properties · Financial Calculators · Chrome Extension
3. "Analyze any listing without leaving the page" (Chrome Extension section)
4. "Everything real estate investors need, all in one place" — Investor Brief · My Properties · Saved Analyses · Investor Calculator
5. "Ask anything. Know what you can afford" — AI Chat copilot + Buying Power
6. "Simple, Transparent Pricing" — Free / Buyer $9.97 / Investor $24.97
7. Logo + CTA close

## Visual direction
- Palette: existing steel-blue tokens (`#6B8DB5`, `#2C3E55`, `#A3C4E0`, off-white) — reuse `COLORS` and `VerticalBackground` component from the confidence video
- Typography: Inter via `@remotion/google-fonts/Inter`
- Motion: `useCurrentFrame` + `spring`/`interpolate` only; gentle fades, subtle scale, staggered entrances (Linear/Notion feel)
- Consistent scene enter/exit fade (10–14 frame overlap feel), no CSS transitions, no backdropFilter

## Scenes (900 frames @ 30fps = 30s)

| # | Frames | Sec | Content |
|---|--------|-----|---------|
| 1 | 0–75 | 0–2.5 | Logo mark scales in + wordmark "HomeLens" + tagline "Big decisions deserve the full picture." |
| 2 | 75–180 | 2.5–6 | Hero mock: "Meet Your Real Estate Advisor" headline + faux search bar with typing effect ("homes near top schools under $600k…") |
| 3 | 180–330 | 6–11 | Five capability chips animate in one-by-one: Market Intelligence Search · Property Analysis · Compare Properties · Financial Calculators · Chrome Extension |
| 4 | 330–450 | 11–15 | Chrome Extension spotlight — panel slides in over a faux listing card, caption: "Analyze any listing without leaving the page." |
| 5 | 450–615 | 15–20.5 | Investor toolkit — 2×2 grid of mini cards: Investor Brief · My Properties · Saved Analyses · Investor Calculator. Header: "Everything investors need." |
| 6 | 615–735 | 20.5–24.5 | AI Chat + Buying Power — split composition: chat bubble with match score badge + affordability card showing "$612,400". Caption: "Ask anything. Know what you can afford." |
| 7 | 735–840 | 24.5–28 | Pricing — three tier cards (Free / Buyer $9.97 / Investor $24.97) scale in, Buyer highlighted |
| 8 | 840–900 | 28–30 | Close: logo + "homelens" wordmark + `homelensais.com` + "Chrome Extension" badge + CTA "Smarter home buying starts here." |

## Files to create
- `remotion/src/FullFeaturesVerticalRoot.tsx` — Composition registration (id: `full-features-vertical`, 1080x1920, 900f, 30fps)
- `remotion/src/FullFeaturesVerticalVideo.tsx` — Orchestrates `<Sequence>`s over shared `VerticalBackground`
- `remotion/src/full-features-index.ts` — `registerRoot`
- `remotion/src/scenes-full/FScene1Logo.tsx`
- `remotion/src/scenes-full/FScene2Hero.tsx`
- `remotion/src/scenes-full/FScene3Capabilities.tsx`
- `remotion/src/scenes-full/FScene4Extension.tsx`
- `remotion/src/scenes-full/FScene5Investor.tsx`
- `remotion/src/scenes-full/FScene6AskAfford.tsx`
- `remotion/src/scenes-full/FScene7Pricing.tsx`
- `remotion/src/scenes-full/FScene8Close.tsx`
- `remotion/scripts/render-full-features-vertical.mjs` — programmatic render script (mirrors existing render-confidence script), output → `/mnt/documents/HomeLens-Full-Features-Vertical.mp4`

## Reused assets
- `public/images/logo.png` (existing, via `staticFile`)
- `VerticalBackground` component (existing)
- No new image generation needed — all mocks built in JSX/SVG

## Sandbox notes
- Silent render (`muted: true`) — ffmpeg build lacks AAC; music to be added in post
- Concurrency 1, no backdropFilter
- Rendered via `node remotion/scripts/render-full-features-vertical.mjs`

## Deliverable
`/mnt/documents/HomeLens-Full-Features-Vertical.mp4` (9:16, ~30s, silent, H.264)
