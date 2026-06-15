## Build & deliver Chrome extension v1.0.5

1. Bump `chrome-extension/manifest.json` version from `1.0.4` → `1.0.5`.
2. Run the extension build (`chrome-extension/build.mjs`) to produce the `dist/` output (Vite popup + esbuild background/content).
3. Package the built `dist/` into a zip at `/mnt/documents/homelens-extension-v1.0.5.zip` using `nix run nixpkgs#zip`.
4. Deliver the zip via a `<presentation-artifact>` tag so you can download it directly.

No frontend app code or backend changes — extension-only.