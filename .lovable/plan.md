# Plan: Create Chrome Extension Laptop Usage Video

We will create a polished video showing a person using the HomeLens Chrome extension on a laptop, featuring the attached screenshot (`Captura de Tela 2026-06-15 às 16.16.29.heic`).

## Recommended Approach: AI Video Generation (Option A) + Remotion Fallback/Alternative

To give you the exact experience requested ("Show the person sitting and using the extension on their laptop; their face does not need to be visible"), we propose the following plan:

### Step 1: Convert & Prepare Screenshot
- Convert `user-uploads://Captura_de_Tela_2026-06-15_às_16.16.29-2.heic` to a high-res PNG/JPG (`src/assets/laptop-screen-ext.png`).

### Step 2: Generate Starting Frame Image (`imagegen`)
- Generate a photorealistic starting frame: A person over-the-shoulder or side view, sitting in a modern, well-lit living room or office, working on a sleek laptop. The laptop screen cleanly displays our prepared HomeLens Chrome extension UI.

### Step 3: Generate Video (`videogen`)
- Feed the starting frame and prompt into `videogen` to produce a 1080p cinematic video clip of the person typing/scrolling on the laptop.
- Save the final MP4 artifact to `/mnt/documents/homelens-extension-laptop-usage.mp4`.

### Step 4 (Alternative/Bonus if desired): Remotion Showcase Composition
- If you also want an ultra-crisp agency motion graphic version (pure code animation), we can add a dedicated scene in `remotion/src/` displaying a sleek device mockup with kinetic typography.

Please click **Implement plan** to proceed!