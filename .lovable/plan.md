
## Deliverable

A single self-contained HTML file at `/mnt/documents/homelens-product-tour.html` that autoplays a silent 27-second 1920×1080 product tour. You open it in a browser (or the artifact preview), screen-record, and add audio separately.

## Approach

- One static HTML page, no JS, no build step. All timing via pure CSS `@keyframes` + `animation-delay`.
- Fixed 1920×1080 stage centered in the viewport (with CSS `transform: scale()` fallback so it fits any screen for recording; recording at native 1080p is fine).
- 5 uploaded images copied into `/mnt/documents/assets/` next to the HTML so the file is portable.
- Google Fonts: Lora (serif headlines) + Inter (sans body).

## Sequence & timing (total 27s)

| # | Section | Start | Duration |
|---|---|---|---|
| 00 | Intro (logo + "HomeLens" + "PRODUCT TOUR") | 0s | 3s |
| 01 | EXTENSION — image 1 | 3s | 4s |
| 02 | PERSONALIZE — image 4 | 7s | 4s |
| 03 | INVESTOR — image 2 | 11s | 4s |
| 04 | AI CHAT — image 5 | 15s | 4s |
| 05 | CALCULATOR — image 3 | 19s | 4s |
| 06 | Outro (tagline + HOMELENS.AI) | 23s | 4s |

Each middle section: card slides in from right + fades (300ms ease-out), text fades up (translateY 12→0), holds ~3.4s, fades out (200ms). Shadow-block color rotates: slate blue → sage green → dusty rose → warm amber → muted plum (no repeats consecutively).

## Global style

- Background `#F0EFE9` with faint 80px grid (CSS linear-gradients, ~6% opacity navy lines).
- Two soft radial-gradient blobs: cool slate-blue top-left, sage green bottom-right, opacity ~12%, heavy blur, behind content.
- Primary text `#1E2A3A`, secondary muted slate `#6B7785`, category label muted blue `#5A7A9E`.
- Left 40% column: small caps "0X · CATEGORY" with leading horizontal rule, large Lora headline (2 lines), Inter body description.
- Right 55%: product image inside a white rounded card (24px radius, subtle inner border, soft shadow) floating over a solid offset colored shadow-block (rotated ~2°, 24–32px offset).
- House logo rendered inline as SVG (line icon, navy stroke).

## Files to create

- `/mnt/documents/homelens-product-tour.html` — the page
- `/mnt/documents/assets/01-extension.png` … `05-calculator.png` — copied from the 5 uploads

## Notes

- No audio elements, no captions, no interactions. Animation runs once on load from frame 0 to 27s, then stops on the outro fade-out state.
- I will include a tiny `?loop=1` query toggle (loop via `animation-iteration-count: infinite` on the master timeline) just in case you want a looping preview while recording — default is play-once.
- I'll spot-check by opening the HTML and screenshotting a few key timestamps before handing off.
