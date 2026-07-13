# HomeLens Chrome Extension Promo — 9:16 Motion Graphic

Create a new vertical (1080x1920) Remotion video that animates the three uploaded slide images into a polished ~18–21 second motion graphic. Output to `/mnt/documents/HomeLens-ChromeExt-Slides-Vertical.mp4`.

## Approach

Rather than re-drawing the slide contents from scratch (which would drift from the polished designs the user already approved), use each slide image as the "hero canvas" per scene and layer motion **on top of** it — reveals, parallax, subtle Ken Burns, floating accent shapes, and animated in/out transitions between slides. The result feels designed, not like a static slideshow.

## Structure (30fps, ~600 frames ≈ 20s)

**Scene 1 — Slide 1 "Every Home Listing. Instantly Smarter." (0–180f, 6s)**
- Slide image enters with a soft scale-in + fade (spring, damping 18)
- Subtle Ken Burns: slow scale 1.00 → 1.04 over the scene
- Blue accent orb drifts behind the phone mockup area (parallax)
- Bottom "Install Free Chrome Extension" CTA area gets a gentle pulse glow near end

**Transition — wipe/slide left (20f overlap)**

**Scene 2 — Slide 2 "Personalized insights, not generic data." (180–380f, ~6.7s)**
- Slide image enters
- Staggered highlight rings sweep across the four side cards (Budget → Preferred Areas → Preferences → Goals) — one every 15f
- Center phone gets a very subtle floating Y motion (sin wave, ±6px)

**Transition — fade through white flash (15f)**

**Scene 3 — Slide 3 "Don't just read listings. Understand them." (380–600f, ~7.3s)**
- Slide image enters
- Left feature list gets a staggered left-fade-in overlay highlight per row (Affordability → Market Insights → Payment Estimates → Investment Potential → Personalized Recommendation), 12f stagger
- Bottom dark CTA panel gets a soft glow pulse in the final 30f
- Final 20f: gentle zoom-out to breathe

## Files to add

- `remotion/public/images/slide-1.png`, `slide-2.png`, `slide-3.png` — copy uploaded images into Remotion public folder
- `remotion/src/SlidesVerticalRoot.tsx` — registers composition `slides-vertical` (1080x1920, 30fps, 600 frames)
- `remotion/src/SlidesVerticalVideo.tsx` — orchestrates 3 scenes via `<Sequence>`s, shared `VerticalBackground`
- `remotion/src/scenes-slides/SSlide1.tsx`
- `remotion/src/scenes-slides/SSlide2.tsx`
- `remotion/src/scenes-slides/SSlide3.tsx`
- `remotion/src/slides-index.ts` — `registerRoot(SlidesVerticalRoot)`
- `remotion/scripts/render-slides-vertical.mjs` — clone of existing render scripts, entry = `slides-index.ts`, output = `/mnt/documents/HomeLens-ChromeExt-Slides-Vertical.mp4`

## Motion system (consistent across scenes)

- Entrance: spring `{ damping: 18, stiffness: 90 }` for hero image; fade+translateY(30→0) for overlays
- Ken Burns: `interpolate(frame, [0, duration], [1.0, 1.04])`
- Highlight ring: absolute-positioned rounded div with `boxShadow: 0 0 0 3px rgba(107,141,181,0.6)` fading in/out over 25f
- Background: reuse existing `VerticalBackground` (subtle blue gradient + drifting orbs), but with a light-mode variant since the slides are on white — background stays as a soft off-white gradient outside the slide bounds (slides are 9:16 already so they fill the frame; background only shows during transitions)

## Render

```
cd remotion && node scripts/render-slides-vertical.mjs
```

Deliverable: `/mnt/documents/HomeLens-ChromeExt-Slides-Vertical.mp4`

## Out of scope

- No audio/voiceover
- No changes to existing videos, scenes, or web app
- No redesign of the slide artwork itself — the uploaded images are the source of truth
