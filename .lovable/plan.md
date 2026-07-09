## Goal
Replace the current BRRRR calculator marketing screenshot (currently reusing the Investor Calculator asset) with the uploaded BRRRR calculator UI screenshot.

## Where the image is used
- `src/components/marketing/featureRegistry.tsx` — the `brrrr-calculator` feature definition currently points to `investorCalculatorAsset.url`.
- That screenshot renders on `/features/brrrr-calculator` (via `FeaturePage.tsx`).

## Plan
1. Create a Lovable Asset from the uploaded image (`user-uploads://image-62.png`) → `src/assets/brrrr-calculator.png.asset.json`.
2. Import the new asset in `src/components/marketing/featureRegistry.tsx`.
3. Update the `brrrr-calculator` feature's `screenshot` and `screenshotAlt` to use the new asset.

## Files changed
- `src/assets/brrrr-calculator.png.asset.json` (new asset pointer)
- `src/components/marketing/featureRegistry.tsx` (import + screenshot swap)

## Not changed
- `/calculators/brrrr` page UI itself
- Mortgage / Buying Power calculators
- Backend, schema, RLS, auth