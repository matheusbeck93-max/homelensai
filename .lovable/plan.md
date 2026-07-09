## Adjustments to Full-Features Vertical Video

Two focused tweaks to `HomeLens-Full-Features-Vertical.mp4`, then re-render.

### 1. Make animations fill the 9:16 frame better
Scale up type, cards, icons, and padding across scenes so less negative space remains.

- **FScene1Logo** — logo mark ~1.4x larger, wordmark font size up (~140 → 180), tagline larger.
- **FScene2Hero** — headline 68 → 96, search bar padding + font (28 → 36), icon box bigger.
- **FScene3Capabilities** — header 54 → 72; capability cards taller (padding 22 → 32), icon 64 → 84, title 28 → 36, description 18 → 22; horizontal padding 60 → 40 so cards stretch wider.
- **FScene4Extension** — listing card + extension panel enlarged (see #2), heading 48 → 64.
- **FScene5Investor** — 2×2 grid tiles taller and edge-to-edge, header 54 → 72, tile labels ~28 → 36.
- **FScene6AskAfford** — chat bubble + affordability card widened to near-full frame, key numbers ~60 → 88.
- **FScene7Pricing** — three pricing cards taller/wider, price numbers larger, header 54 → 72.
- **FScene8Close** — logo + wordmark + URL scaled up, more visual weight.

Horizontal side padding reduced from ~60px to ~40px in scenes with card grids to give elements more room.

### 2. FScene4Extension — add a real house image to the faux listing
Currently the "listing card" behind the extension panel is just a blue gradient block.

- Generate a photorealistic exterior house image (`imagegen--generate_image`, standard quality, 1024x768, warm daylight suburban craftsman) → save to `remotion/public/images/listing-house.jpg`.
- In `FScene4Extension.tsx`, replace the gradient placeholder `<div>` with `<Img src={staticFile("images/listing-house.jpg")}>` filling the card's photo area (object-fit: cover). Keep the price/beds/baths footer below it.
- Also enlarge the listing card (wider, taller photo area ~360 → 480) and the extension panel so the composition dominates the frame.

### 3. Re-render
Run `node remotion/scripts/render-full-features-vertical.mjs` → overwrites `/mnt/documents/HomeLens-Full-Features-Vertical.mp4`.

### Files touched
- `remotion/src/scenes-full/FScene1Logo.tsx` … `FScene8Close.tsx` (size tweaks)
- `remotion/src/scenes-full/FScene4Extension.tsx` (house image + sizing)
- `remotion/public/images/listing-house.jpg` (new)

No changes to composition duration, scene order, palette, or fonts.
