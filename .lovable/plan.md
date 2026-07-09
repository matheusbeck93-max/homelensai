# BRRRR + Buying Power tabs, BRRRR feature page, homepage feature card

Three focused additions. No changes to existing calc math, AI edge functions, auth, or RLS.

## 1. Tabs on `/calculators`

Today `src/pages/Calculators.tsx` renders Buying Power + Mortgage stacked in a 2-column grid, plus a text link to `/calculators/brrrr`. Wrap the existing sections in shadcn `Tabs` so the page has three tabs:

- **Buying Power** — the existing Buying Power Summary card (inputs) + Buying Power Results card.
- **Mortgage** — the existing Mortgage Calculator card + Mortgage Results card + the "Generate AI insights" block (unchanged behavior, still uses `calculator-insights`).
- **BRRRR** — renders the existing `CalculatorBrrrr` page body as a tab.

Details:
- Use `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` from `@/components/ui/tabs`, `defaultValue="buying-power"`, `TabsList` with `grid grid-cols-3` on mobile.
- Sync tab to URL via `?tab=buying-power|mortgage|brrrr` so links + refresh preserve state and so `/calculators?tab=brrrr` is a valid entry point. Keep `/calculators/brrrr` working (unchanged) — just add a small redirect note: the standalone route stays for SEO/canonical.
- Refactor `CalculatorBrrrr.tsx` to export both the full page (default export, keeps its own `<Helmet>` + `Navigation` for the standalone route) **and** a named `BrrrrCalculatorPanel` component containing just the calculator UI (inputs + results + AI insights, no `Navigation`/`Helmet`). The tab imports `BrrrrCalculatorPanel`; the standalone page keeps rendering it too. No duplication of math.
- Remove the "Investor? Try the BRRRR calculator" inline paragraph in `Calculators.tsx` — the tab replaces it.
- Update the page `<title>`/description on `/calculators` to mention all three: "Buying Power, Mortgage & BRRRR Calculators | HomeLens".

## 2. BRRRR feature page

Add BRRRR to the marketing feature system so `/features/brrrr-calculator` renders via the existing `FeaturePage` component.

Edit `src/components/marketing/featureRegistry.tsx`:
- Add a new `FeatureSlug` value: `"brrrr-calculator"`.
- Add a `FEATURES` entry:
  - `name`: "BRRRR Calculator"
  - `icon`: `Repeat` (from `lucide-react`)
  - `short`: "Model buy-rehab-rent-refinance deals in seconds."
  - `headline`: "The BRRRR math, honest and fast."
  - `subheadline`: "Plug in purchase, rehab, ARV, rent, and refi terms. See all-in cost, capital left in the deal, monthly cash flow, and cash-on-cash return after refinance — with an AI read on the deal."
  - Three benefits: "All-in cost, not just purchase price", "Capital recycled vs left in deal", "AI verdict on the deal".
  - `screenshot`: reuse `investorCalculatorAsset.url` (closest existing asset — avoids generating a new image; can be swapped later).

The generic `FeaturePage` already renders any registered slug at `/features/:slug`, so no routing changes are needed.

Also update `FeaturePage.tsx` CTA: when `slug === "brrrr-calculator"`, the "Get started free" button links to `/calculators?tab=brrrr` in addition to the signup CTA (small extra `<Button variant="ghost">` "Open the calculator" — kept minimal).

## 3. Homepage feature card

In `src/pages/Index.tsx`, add a new card to the "Investor Tools — feature card grid" array (currently 6 cards):

```
{
  icon: Repeat,
  title: "BRRRR Calculator",
  desc: "Model buy-rehab-rent-refi deals.",
  href: "/features/brrrr-calculator",
  body: <mini-preview: ARV $310k · Cash left $12k · CoC 11.4%>
}
```

Import `Repeat` from `lucide-react`. Grid already uses `lg:grid-cols-3`, so a 7th card wraps cleanly.

## SEO

- `/calculators/brrrr` keeps its existing canonical + JSON-LD (no change).
- `/calculators` title/description updated to include BRRRR.
- `/features/brrrr-calculator` inherits per-page `<Helmet>` tags already emitted by `FeaturePage.tsx`.
- Sitemap: add `/features/brrrr-calculator` to `scripts/generate-sitemap.ts` `staticEntries` (priority 0.6, monthly). `/calculators/brrrr` already listed.

## Files

Edit
- `src/pages/Calculators.tsx` — wrap in `Tabs`, add BRRRR tab, update Helmet title/desc.
- `src/pages/CalculatorBrrrr.tsx` — extract `BrrrrCalculatorPanel` named export; default export still renders standalone page.
- `src/components/marketing/featureRegistry.tsx` — add `brrrr-calculator` feature entry + slug.
- `src/pages/marketing/FeaturePage.tsx` — small BRRRR-specific extra CTA link.
- `src/pages/Index.tsx` — add BRRRR card to investor feature grid.
- `scripts/generate-sitemap.ts` — add `/features/brrrr-calculator`.

Create
- (none)

## Verification

- `tsgo` typecheck.
- Manual: `/calculators` shows 3 tabs, each tab renders its calculator, `?tab=brrrr` deep-link works, `/calculators/brrrr` still works standalone, `/features/brrrr-calculator` renders, homepage grid shows new BRRRR card linking to it.

## Out of scope

- No new AI edge function (BRRRR insights already deployed).
- No new screenshot asset for BRRRR (reuses investor calculator image; can commission a dedicated one later).
- No changes to mortgage/buying-power math.
