---
name: Tier enforcement matrix (Free → Buyer → Investor)
description: How feature gating is enforced across UI + edge functions, and which features are Buyer vs Investor.
type: feature
---

## Contract

Every gated feature is declared in `FEATURE_GATES` (frontend: `src/lib/subscriptionPlans.ts`; backend mirror: `supabase/functions/_shared/featureGates.ts`). The two maps MUST stay identical.

- **Buyer-tier** features list `['buyer', 'investor']` → required tier is `buyer`.
- **Investor-only** features list `['investor']` → required tier is `investor`.

## UI gating

- `src/components/subscription/TierGate.tsx` — wrap any feature surface with `<TierGate feature="FEATURE_KEY" featureName="…">…</TierGate>`. Users without access see the original UI behind blur + Upgrade overlay (CTA → `/pricing?target=<tier>`).
- `useSubscription().hasAccess(feature)` for inline boolean checks.

Currently wrapped page-level: `/investor/calculator` (INVESTOR_CALCULATOR), `MarketComparator` (MARKET_COMPARATOR), `/compare` (PROPERTY_COMPARISON). `SavedAnalyses` already had its own paywall; `PropertyPDFExport`, `NeighborhoodPersonality`, `WeeklyPicksSettings`, `AlertSettings`, `SaveAnalysisButton` use inline `hasAccess` + UpgradeModal.

## Backend gating

Use `enforceFeature(req, 'FEATURE_KEY')` from `supabase/functions/_shared/tierGate.ts`. Returns `{ ok: false, error: Response }` (HTTP 403, body `{ error: 'tier_required', feature, requiredTier, currentTier, message }`) when denied — return `gate.error` directly.

Enforced in: `market-comparator`, `compare-properties-ai`, `generate-property-pdf`, `elevenlabs-tts`, `neighborhood-personality`, `neighborhood-insights`, `investor-brief`, `investor-chat`. `save-analysis` already had its own `premium_required` 403; keep as-is.

`perplexity-chat`, `ai-analyze`, `ai-chat`, `fetch-property`, `search-listings`, `market-trends`, `get-state-tax-data`, `get-mapbox-token` stay open (rate-limit / credit-only enforcement).

## Adding a new gate

1. Add the key to both `FEATURE_GATES` maps with the right tier list.
2. Wrap the UI in `<TierGate feature="NEW_KEY" featureName="…">`.
3. Call `enforceFeature(req, 'NEW_KEY')` at the top of the corresponding edge function (after CORS, before any expensive work).