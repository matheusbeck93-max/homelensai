# Tier enforcement — page-level soft gates + backend lockdown

The current setup only wraps a few buttons. Real fix: **whole feature screens render but sit behind a blurred preview with an Upgrade CTA** when the user's tier is too low, plus every paid edge function rejects with 403 so the gate can't be bypassed by direct API calls.

## 1. Page-level soft gates (frontend)

Wrap the entire page body in `<TierGate feature="…">`. The page still mounts (so headers, sidebar, layout render normally), but the feature content is blurred and the Upgrade overlay sits on top. Forms cannot be filled in.

| Route / Page | Required tier | Feature key |
|---|---|---|
| `/investor` (InvestorBrief) | Investor | `INVESTOR_CALCULATOR` |
| `/investor/calculator` | Investor | `INVESTOR_CALCULATOR` *(already done — verify)* |
| `/my-properties` (MyProperties) | Investor | `INVESTOR_CALCULATOR` |
| `/owned-property/:id` (OwnedPropertyDetail) | Investor | `INVESTOR_CALCULATOR` |
| `/compare` (Compare) | Buyer | `PROPERTY_COMPARISON` *(already done — verify)* |
| `/saved-analyses` (SavedAnalyses) | Buyer | `SAVED_ANALYSES` — replace ad-hoc `isPremium` lock card with the unified `<TierGate>` overlay |
| MarketComparator section | Investor | `MARKET_COMPARATOR` *(already done — verify)* |

`TierGate` already supports the blurred-preview + Upgrade-overlay pattern; we just expand where it's used. Pages stay reachable so SEO/headers work and the user sees what they'd get.

Loading guard: each page must wait for `useSubscription().loading === false` before rendering `<TierGate>` to avoid a flash of unauthorized content (skeleton in the meantime).

## 2. Inline component gates (frontend)

Keep these as inline blurs/disables (not whole-page) because they sit inside otherwise-free pages:

| Surface | Fix |
|---|---|
| `PropertyPDFExport.tsx` | Use `PDF_EXPORT` (currently wrong key `EXCEL_WORKFLOW`) |
| `NeighborhoodPersonality.tsx` | Use `NEIGHBORHOOD_PERSONALITY` (currently wrong key `INVESTMENT_SCORE`) |
| `NeighborhoodInsights.tsx` | Gate fetch + render behind `NEIGHBORHOOD_INSIGHTS` |
| `AlertSettings.tsx` | Use `PROPERTY_ALERTS` (currently wrong key `UNLIMITED_EXTENSION_ANALYSIS`) |
| `VoiceInterface.tsx` mic button | Hide/disable when `!hasAccess('VOICE_MODE')` |
| Save-analysis button in chat | Already shows upgrade modal — verify it uses `SAVED_ANALYSES` |

## 3. Backend lockdown (the real security boundary)

Add `enforceFeature(req, '<KEY>')` at the top of each handler. Returns 403 `tier_required` before any work. Without this, anything above is bypassable via direct `fetch`.

| Edge function | Required tier | Feature key |
|---|---|---|
| `ai-chat` | Buyer for unlimited chat; gate Excel/workflow tool branch with `EXCEL_WORKFLOW` | `UNLIMITED_CHAT` + branch |
| `save-analysis` | Buyer | `SAVED_ANALYSES` (replace existing ad-hoc `premium_required`) |
| `property-alerts-evaluate` | Buyer | `PROPERTY_ALERTS` |
| `check-property-alerts` | Buyer (skip when cron secret present) | `PROPERTY_ALERTS` |
| `send-weekly-picks` | Buyer (skip when cron secret present) | `WEEKLY_PICKS` |
| `calculator-insights` | Investor | `INVESTOR_CALCULATOR` |
| `owned-property-chat` | Investor | `INVESTOR_CALCULATOR` |
| `property-valuation-refresh` | Investor | `INVESTOR_CALCULATOR` |
| `enrich-property` | Investor | `INVESTOR_CALCULATOR` |
| `compare-properties-ai`, `market-comparator`, `investor-brief`, `investor-chat`, `neighborhood-insights`, `neighborhood-personality`, `generate-property-pdf`, `elevenlabs-tts` | already gated — verify only |

Cron-invoked functions keep their `CRON_SHARED_SECRET` bypass; per-row processing inside them already filters by each recipient's tier.

## 4. Buyer plan limits — audit

Walk the FEATURE_GATES matrix in `src/lib/subscriptionPlans.ts` against what the Buyer plan card promises:

- Buyer should NOT have: `INVESTOR_CALCULATOR`, `STRESS_SCENARIOS`, `ARM_SCENARIOS`, `TAX_MODELING_MFJ`, `INVESTMENT_PROJECTIONS`, `MARKET_COMPARATOR`, `INVESTOR_EXCEL_WORKBOOKS`, `INVESTOR_EMAIL_DIGESTS`. ✓ Already correct in the matrix.
- Buyer SHOULD have: `UNLIMITED_CHAT`, `MATCH_SCORE`, `PERSONALIZED_CHAT`, `SAVED_ANALYSES`, `PROPERTY_ALERTS`, `WEEKLY_PICKS`, `NEIGHBORHOOD_INSIGHTS`, `NEIGHBORHOOD_PERSONALITY`, `PROPERTY_COMPARISON`, `EXCEL_WORKFLOW`, `PDF_EXPORT`, `VOICE_MODE`, `UNLIMITED_EXTENSION_ANALYSIS`. ✓ Already correct.
- Action: fix the mis-keyed components in §2 so Buyers actually get what the matrix says they should (PDF export, alerts, personality, insights). No matrix edit needed.

## Verification

- Free user → `/investor`, `/my-properties`, `/owned-property/:id`, `/investor/calculator`, `/compare`, `/saved-analyses` all render with blurred preview + "Upgrade to Investor/Buyer" overlay. No form is interactive.
- Buyer user → `/investor`, `/my-properties`, `/owned-property/:id`, `/investor/calculator` show Investor upgrade overlay. `/compare`, `/saved-analyses` are fully usable.
- Investor user → full access everywhere.
- `supabase--curl_edge_functions` against each gated function with Free / Buyer / Investor JWTs → 403 / 403 or 200 / 200 as appropriate.

## Out of scope

No DB schema, pricing or copy changes. `perplexity-chat`, `ai-analyze`, `fetch-property`, `search-listings`, billing, mapbox, state-tax remain open.
