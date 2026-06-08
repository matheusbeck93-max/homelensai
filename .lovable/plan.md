## Goal

Get the Top-Up flow producing real Stripe Checkout URLs and start a low-risk Sonnet rollout on three safe surfaces.

## Steps

1. **Update credit-pack Price ID secrets to real values** (Stripe products already created earlier):
   - `STRIPE_CREDIT_PACK_SMALL_PRICE_ID` → `price_1TgAXYPfVIpcDpxSSQUBtwoW` ($5)
   - `STRIPE_CREDIT_PACK_MEDIUM_PRICE_ID` → `price_1TgAZpPfVIpcDpxSCoKxiZEU` ($10)
   - `STRIPE_CREDIT_PACK_LARGE_PRICE_ID` → `price_1TgAa6PfVIpcDpxSDjzmXXJQ` ($25)

2. **Add first canary batch of Sonnet rollout flags** (10% rollout on lowest-risk surfaces — short, bounded outputs, easy to revert):
   - `AI_ROUTER_PREFERENCES_ASSISTANT_ENABLED=1` + `AI_ROUTER_PREFERENCES_ASSISTANT_ROLLOUT_PCT=10`
   - `AI_ROUTER_PROPERTY_VALUATION_COMMENTARY_ENABLED=1` + `AI_ROUTER_PROPERTY_VALUATION_COMMENTARY_ROLLOUT_PCT=10`
   - `AI_ROUTER_EXTENSION_LISTING_ANALYSIS_ENABLED=1` + `AI_ROUTER_EXTENSION_LISTING_ANALYSIS_ROLLOUT_PCT=10`

3. **Smoke test `buy-credits`** via curl to confirm a real Stripe Checkout URL comes back (no more `No such price` error).

## Out of scope

- No code edits — only secret/env-var updates plus a read-only test call.
- Higher-traffic surfaces (`general_chat`, `investor_chat`, `investor_brief`, `my_properties_strategy`, `artifact_generation`, `alerts_engine`) stay off until canary metrics are clean.
