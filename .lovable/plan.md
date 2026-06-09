# Tier-Based Feature Gating (Free → Buyer → Investor)

## Goal
- **Free users:** can see all Buyer + Investor features (blurred preview + Upgrade overlay), cannot use them.
- **Buyer users:** can see Investor-only features (blurred preview + Upgrade overlay), cannot use them.
- Enforced on **both** the UI and the edge functions so the limit can't be bypassed.

## Source of truth
`src/lib/subscriptionPlans.ts` → `FEATURE_GATES` already maps every feature to the tiers that may use it. We will gate every key in that map. No new feature keys are introduced.

## Frontend changes

### 1. Reusable hook + tier helper
- Extend `useSubscription` with `requireFeature(feature)` returning `{ allowed, requiredTier, openUpgrade }`. `openUpgrade` opens the existing `UpgradeModal` / routes to `/pricing` with the correct target tier preselected.
- No change to `FEATURE_GATES`; we keep the existing `hasAccess(feature)`.

### 2. FeatureGate component
- Already exists (`src/components/subscription/FeatureGate.tsx`) with blurred preview + Upgrade overlay — keep as the visual contract.
- Add an `infer requiredTier from FeatureKey` convenience wrapper `<TierGate feature="MATCH_SCORE">…</TierGate>` so callers don't repeat the tier string.

### 3. Wrap every gated entry point
For each `FeatureKey`, wrap the UI surface(s) below in `<TierGate>` (preview keeps rendering, interactions blocked):

| Feature | Files to wrap |
| --- | --- |
| MATCH_SCORE / INVESTMENT_SCORE | `components/ui-blocks/PropertyResultsCarousel.tsx`, `components/property/PropertyCard.tsx`, `components/PriceFairnessMeter.tsx`, score chips in `pages/PropertyDetail.tsx` |
| PERSONALIZED_CHAT | personalization toggle in `pages/Chats.tsx` (chat still works, personalization off) |
| UNLIMITED_CHAT / UNLIMITED_PROPERTY_ANALYSIS | already enforced via daily-limit + credits; surface upgrade CTA on the 429 path in `pages/Chats.tsx` |
| UNLIMITED_HISTORY | `pages/Chats.tsx` history list (cap visible to free at 5; rest behind overlay) |
| SAVED_ANALYSES | `pages/SavedAnalyses.tsx`, `components/chat/SaveAnalysisButton.tsx` |
| PROPERTY_ALERTS | `components/console/AlertsPanel.tsx`, `components/subscription/AlertSettings.tsx` |
| WEEKLY_PICKS | `components/subscription/WeeklyPicksSettings.tsx` |
| NEIGHBORHOOD_INSIGHTS / NEIGHBORHOOD_PERSONALITY | `components/NeighborhoodInsights.tsx`, `components/NeighborhoodPersonality.tsx` |
| PROPERTY_COMPARISON | `pages/Compare.tsx`, `components/PropertyComparison.tsx`, `components/comparison/ComparisonFloatingBar.tsx` |
| EXCEL_WORKFLOW | Excel CTA inside `components/ui-blocks/UIBlockRenderer.tsx` and chat workbook generator |
| PDF_EXPORT | `components/PropertyPDFExport.tsx` |
| VOICE_MODE | `components/chat/TextToSpeechButton.tsx`, `components/VoiceInterface.tsx` |
| UNLIMITED_EXTENSION_ANALYSIS | already backend-enforced; no UI change here |
| INVESTOR_CALCULATOR / STRESS_SCENARIOS / ARM_SCENARIOS / TAX_MODELING_MFJ / INVESTMENT_PROJECTIONS | `pages/InvestorCalculator.tsx` (Simple stays free? — see decision below), `components/ui-blocks/HomeLensInvestorCalculator.tsx`, advanced-mode tabs |
| MARKET_COMPARATOR | `components/investor/MarketComparator.tsx` |
| INVESTOR_EXCEL_WORKBOOKS / INVESTOR_EMAIL_DIGESTS | Investor-only Excel button in `UIBlockRenderer`, digest toggle in console |

**Decision needed in build mode:** `/investor` Simple calculator — current marketing says "Buying Power / Mortgage" are Free, "Investor Calculator" is Investor. We'll treat the *Investor* calculator (rental yield, IRR, scenarios) as Investor-gated; Mortgage + Buying Power stay free, matching the plan copy.

### 4. Navigation
- Keep all nav links visible. Pages render the gated content with `<TierGate>` rather than redirecting, so users always *see* what they'd unlock.

## Backend changes

### 1. New shared helper
`supabase/functions/_shared/tierGate.ts`:
- `loadUserTier(authHeader): Promise<SubscriptionTier>` (reads `profiles.subscription_status`, validates against allowed set, defaults `free`).
- `enforceFeature(req, feature): Promise<{ tier, error?: Response }>` — returns 403 `{ error: 'tier_required', requiredTier, feature }` when not allowed.
- Mirror of the frontend `FEATURE_GATES` map (kept in `_shared/featureGates.ts`, imported by both sides to stay in sync).

### 2. Apply `enforceFeature` to edge functions
| Function | Feature key(s) |
| --- | --- |
| `ai-chat` | `UNLIMITED_CHAT` is rate-limited, but block `EXCEL_WORKFLOW` / personalization tool calls when tier missing |
| `compare-properties-ai` | `PROPERTY_COMPARISON` |
| `generate-property-pdf` | `PDF_EXPORT` |
| `elevenlabs-tts` | `VOICE_MODE` |
| `save-analysis` | `SAVED_ANALYSES` |
| `neighborhood-insights` | `NEIGHBORHOOD_INSIGHTS` |
| `neighborhood-personality` | `NEIGHBORHOOD_PERSONALITY` |
| `investor-brief` / `investor-chat` | `INVESTOR_CALCULATOR` (Investor only) |
| `market-comparator` | `MARKET_COMPARATOR` |
| `property-alerts-evaluate`, `check-property-alerts`, `send-weekly-picks` | `PROPERTY_ALERTS`, `WEEKLY_PICKS` — cron already runs server-side; add filter so only Buyer+/Investor recipients are processed |
| `calculator-insights` | `INVESTOR_CALCULATOR` when Advanced fields present |

Functions that should remain open: `perplexity-chat` (rate-limit only), `ai-analyze`, `fetch-property`, `search-listings`, `check-subscription`, `buy-credits`, `create-checkout`, `customer-portal`, `stripe-webhook`, `market-trends`, `get-state-tax-data`, `get-mapbox-token`.

### 3. Error contract
- Status `403`, body `{ error: 'tier_required', requiredTier: 'buyer'|'investor', feature: <FeatureKey> }`.
- Frontend `aiClient` / fetch helpers intercept this and pop `UpgradeModal` with the right tier (replaces ad-hoc error toasts on those calls).

## Telemetry
- Reuse existing `upgrade-cta-click` edge function: every overlay Upgrade button and every 403 → modal logs `{ source: <feature>, tier: <current>, requiredTier }`.

## Out of scope
- No pricing or plan-feature copy changes.
- No DB schema changes.
- Existing daily-limit / AI-credits logic stays as-is (those already enforce free-tier message caps).
- Saved-Searches and Favorites stay removed.

## Verification
- Logged in as Free → visit `/investor`, `/saved-analyses`, `/compare`, a property detail page, console alerts: see blurred content + Upgrade overlay. Click Upgrade → checkout for Buyer (or Investor where applicable).
- Logged in as Buyer → Buyer features usable; Investor Calculator Advanced tab, Market Comparator, Investor Excel show blurred + Upgrade to Investor overlay.
- `curl` each gated edge function with a Free user JWT → 403 `tier_required`; with Buyer JWT → 403 only for Investor-only endpoints; with Investor JWT → all pass.

## Files touched (summary)
- New: `src/components/subscription/TierGate.tsx`, `supabase/functions/_shared/tierGate.ts`, `supabase/functions/_shared/featureGates.ts`.
- Edited: `useSubscription.tsx`, `aiClient.ts` (403 handler), each UI file in the table above, each edge function in the table above.
- Memory: add `mem://faturamento/tier-enforcement-matrix` describing the gating contract.
