# 30s Vertical Promo Video — "Buy with confidence. Not stress."

Build a new 9:16 (1080x1920, 30fps, 900 frames) Remotion composition that follows the 6-scene script provided. Render to `/mnt/documents/HomeLens-Confidence-Vertical.mp4`.

## Composition

Register a new `<Composition id="confidence-vertical" />` in a new `ConfidenceVerticalRoot.tsx` with its own entry file `src/confidence-index.ts` and render script. Reuses existing brand colors from `MainVideo.tsx` (steel-blue palette) and Inter via `@remotion/google-fonts/Inter`.

## Scenes (900 frames total @ 30fps)

| # | Frames | Duration | Content |
|---|--------|----------|---------|
| 1 | 0–90 | 0–3s Hook | Rapid stack of listing site "cards" (Zillow / Realtor / Redfin labels) scrolling upward fast, faux browser tabs across top, a cursor darting. Text fades in bottom: *"Searching for your next home shouldn't feel like this."* |
| 2 | 90–240 | 3–8s Problem | Zoom into one listing card that expands to a mock property detail (photo placeholder + price + specs). Four questions fade in staggered, floating around the card: *"Is this a good deal?" / "Why has it been on the market so long?" / "Are there hidden issues?" / "Is the neighborhood right?"* No answers. |
| 3 | 240–360 | 8–12s Introduce | Chaos calms, questions dissolve. HomeLens extension panel slides in from the right over the listing (uses existing `images/chrome-ext-home.jpg` or `images/logo.png` inside a stylized panel frame). Text centered below: *"Meet HomeLens."* |
| 4 | 360–660 | 12–22s Value | Six feature cards cycle in ~50 frames each with subtle scale/parallax: **AI Summary · Neighborhood Insights · Property Analysis · Investment Score · Market History · Ask AI anything.** Each card uses an icon (SVG glyph) + label + one-line supporting text. Gentle zoom-in per card. |
| 5 | 660–840 | 22–28s Payoff | Calm, spacious. Single listing card centered, gentle drift, soft glow. Two-line text with staggered fade: *"Buy with confidence."* then *"Not stress."* |
| 6 | 840–900 | 28–30s Logo | HomeLens logo (spring scale) + wordmark + `homelensais.com` + small "Chrome Extension" badge pill. CTA: *"Smarter home buying starts here."* |

## Motion System

- **Entrance:** spring `{ damping: 20, stiffness: 100 }` with y-offset 40→0 and opacity 0→1
- **Exit:** short opacity fade (last 15 frames of each scene) — no black cuts
- **Scene transitions:** sequential `<Sequence>` cuts with overlapping opacity fades (last 10 frames of outgoing + first 10 of incoming) — 200–400ms subtle feel
- **Persistent background:** reuse `VerticalBackground` component (existing dark steel-blue gradient with slow drift) so scenes flow into each other
- **Typography:** Inter 700 for headlines, Inter 400/500 for body. Generous whitespace, no all-caps except tiny eyebrow labels.
- **No flashy effects, no `backdropFilter`** (sandbox constraint).

## Files to Create

```
remotion/src/
  ConfidenceVerticalVideo.tsx           # main composition
  ConfidenceVerticalRoot.tsx            # registers "confidence-vertical" id
  confidence-index.ts                   # registerRoot entry
  scenes-confidence/
    CScene1Hook.tsx
    CScene2Problem.tsx
    CScene3Introduce.tsx
    CScene4Features.tsx
    CScene5Payoff.tsx
    CScene6Logo.tsx
remotion/scripts/
  render-confidence-vertical.mjs        # renders to /mnt/documents/HomeLens-Confidence-Vertical.mp4
```

Reuses existing assets: `public/images/logo.png`, `public/images/chrome-ext-home.jpg` (if present), plus inline SVG icons for feature cards. No new image generation required.

## Rendering

Follow the existing `render-vertical.mjs` pattern (chrome-for-testing, muted, concurrency 1). Final MP4: `/mnt/documents/HomeLens-Confidence-Vertical.mp4`.

## Notes

- **No audio** — sandbox ffmpeg lacks aac; music must be added in an external editor. The brief will be delivered as visuals only.
- All motion via `useCurrentFrame()` + `interpolate`/`spring` — no CSS transitions.
- Duration is exactly 900 frames to hit 30s.
