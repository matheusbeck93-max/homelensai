# BRRRR Calculator Page

Adds a dedicated `/calculators/brrrr` page that captures the high-intent "BRRRR calculator" search demand flagged by the SEO scanner, while matching the look and mechanics of the existing `/calculators` page.

## What the user gets

A single-page BRRRR (Buy, Rehab, Rent, Refinance, Repeat) calculator that:

- Uses the same two-column layout, cards, typography, and buttons as `/calculators` so it feels native.
- Computes the numbers investors actually care about (all-in cost, ARV-based refi, capital left in deal, monthly cash flow, cash-on-cash return after refi).
- Sends the results to a new AI insights edge function that returns a plain-English read (deal health, capital recycled, risks, next steps).
- Ships with per-page SEO metadata, JSON-LD, sitemap entry, and internal links from `/calculators` and `/faq`.

## Inputs (grouped in 2 cards)

**Acquisition & Rehab**
- Purchase price
- Closing costs
- Rehab budget
- Holding months + monthly holding cost (taxes, insurance, utilities during rehab)

**Refinance & Rent**
- After-Repair Value (ARV)
- Refi LTV % (default 75%)
- Refi interest rate %
- Loan term (years, default 30)
- Monthly rent
- Monthly operating expenses (taxes, insurance, PM, maintenance, vacancy allowance)

Defaults mirror the existing calculator (e.g. tax 1.2%, sensible LTV/term) so the page produces a result on first paint after minimal typing.

## Calculations (client-side, pure)

```text
allInCost         = purchasePrice + closingCosts + rehabBudget + holdingMonths * monthlyHoldingCost
refiLoanAmount    = ARV * (refiLtvPct / 100)
cashLeftInDeal    = max(allInCost - refiLoanAmount, 0)
cashRecycled      = min(allInCost, refiLoanAmount)   // capital pulled back out
monthlyPI         = amortize(refiLoanAmount, refiRate, refiTermYears)
monthlyCashFlow   = monthlyRent - monthlyOpEx - monthlyPI
annualCashFlow    = monthlyCashFlow * 12
cashOnCashPct     = cashLeftInDeal > 0 ? (annualCashFlow / cashLeftInDeal) * 100 : Infinity
equityCreated     = ARV - allInCost
```

A results card renders each value with clear labels, formatted currency, and a color cue on cash-on-cash (green ≥ 8%, yellow 4-8%, red < 4%) — matching the DTI color pattern already in `/calculators`.

## AI insights

New Supabase edge function `supabase/functions/brrrr-insights/index.ts`:

- Mirrors `calculator-insights` structure: `handleCors`, `precheckAiCredits('brrrr-insights')`, `callAiGateway`, `deductAiCredits`, `jsonResponse`/`errorResponse`, wrapped in `withRequestOrigin`.
- Uses Lovable AI Gateway (`openai/gpt-5.5`, no direct provider key) with a system prompt tuned for BRRRR: deal health verdict first, then bullets covering ARV realism, capital recycled vs left in deal, cash flow adequacy, and 2-3 concrete next steps. Answer-first, ~180 words max.
- Registered in `supabase/config.toml` alongside `calculator-insights` (`verify_jwt = true`).

Frontend calls it via `supabase.functions.invoke("brrrr-insights", { body: { inputs, results } })`, reuses `useBudgetCap` + `BudgetCapBanner` + `BudgetCapBlocker`, and surfaces 429/402 errors via existing `parseAndRecordBudget402` helper.

## SEO

`src/pages/CalculatorBrrrr.tsx` head via `react-helmet-async`:

- `<title>`: "BRRRR Calculator — Cash-on-Cash After Refinance | HomeLens"
- `<meta name="description">`: "Free BRRRR calculator. Enter purchase, rehab, ARV, and rent to see all-in cost, capital left in deal, monthly cash flow, and cash-on-cash return after refinance."
- `<link rel="canonical" href="https://homelensais.com/calculators/brrrr" />`
- Matching `og:*` and `twitter:*` (title/description/url), `og:type=website`.
- JSON-LD `SoftwareApplication` (subtype `FinancialApplication`, `applicationCategory: FinanceApplication`, `offers.price: 0`) plus a `BreadcrumbList` (Home → Calculators → BRRRR).
- Internal links: add a "BRRRR calculator" card/link on `/calculators` and one FAQ entry on `/faq` pointing to the new page.
- Sitemap: append `{ path: "/calculators/brrrr", changefreq: "monthly", priority: "0.7" }` to `staticEntries` in `scripts/generate-sitemap.ts`.

## Routing & access

- New route in `src/App.tsx`: `<Route path="/calculators/brrrr" element={<CalculatorBrrrr />} />`.
- Public route (no `ProtectedRoute` wrapper) so it's crawlable; the AI-insights button routes signed-out users to `/auth?redirect=/calculators/brrrr` (same pattern `/calculators` uses).

## Files

Create
- `src/pages/CalculatorBrrrr.tsx`
- `supabase/functions/brrrr-insights/index.ts`

Edit
- `src/App.tsx` (route + lazy import if others are lazy)
- `src/pages/Calculators.tsx` (link card to BRRRR)
- `src/pages/marketing/Faq.tsx` (one FAQ item + JSON-LD updated automatically since it's built from the array)
- `scripts/generate-sitemap.ts` (add entry)
- `supabase/config.toml` (register new function)

No changes to auth, RLS, existing tables, or the mortgage/buying-power calculator logic.

## Verification

- `tsgo` for typecheck.
- Manual: load `/calculators/brrrr`, confirm inputs → results update live, "Generate AI insights" returns text, head tags render (`view-source`), sitemap includes the new URL after `predev`.

## Out of scope

- No new database tables or saved-BRRRR persistence (can follow up if requested).
- No portfolio-level BRRRR repetition modeling (single-deal calculator only).
