
## Stage 1 update (2026-06-15)
- `resolveRentcastTier` lives in `_shared/rentcast.ts` — single source of truth.
- Free tier throws `RentcastUpgradeRequiredError`; tools return `{ error: 'upgrade_required', cta }`. No Perplexity AVM fallback for free users.
- `owned-property-chat` has its own raw-fetch tool loop (MAX 4 iterations) with `estimate_property_value` + `compare_rent_to_market`, pre-filled from PROPERTY CONTEXT. Injects top 10 `user_memories`.
- Tool descriptions ALWAYS lead with "SUCCESS: use the numeric fields" before the error branches — Gemini otherwise utters upgrade text on successful cached calls.
- Boundary tests live in `supabase/functions/_shared/__tests__/rentcast_test.ts` (13 passing).
- Stage 2 (separate PR): wire tools into `ai-chat`, `property-assistant`, and `investor-brief` Deep Dive; extract `buildRentcastTools(ctx)` factory.
---
name: RentCast integration (live)
description: RentCast Foundation tier wired for auto-valuation, AI tools, quota + cache. Don't re-audit.
type: feature
---

**Status: LIVE on Foundation tier ($74/mo, 1000 calls).**

Adapter: `supabase/functions/_shared/rentcast.ts`
- `fetchRentcastValuation(addr)` — direct sale+rent AVM (used by background refresh).
- `getValuationCached(sb, userId, tier, addr)` — cached + quota-enforced (used by chat tools). Throws `RentcastQuotaError`.
- `enforceDailyQuota(sb, userId, tier)` — buyer 5/day, investor 50/day, free 0/day (falls to Perplexity).
- TTLs: value/rent/comps 24h, details 7d.

Tables:
- `rentcast_cache` (service-role only) — keyed by `value+rent:<normalized-addr>`, with `expires_at`.
- `rentcast_usage_log` (user can SELECT own) — drives daily quota window.

AI tools in `investor-chat`:
- `estimate_property_value({ address_line1, city, state, zip, beds?, baths?, sqft?, propertyType? })`
- `compare_rent_to_market({ ...address, currentRent, ... })` → verdict 'below'|'at'|'above' (±5% band)

Tier resolution: `resolveRentcastTier(ctx)` reads `profiles.subscription_status` + `stripe_price_id`; matches investor price IDs → 'investor', active/trialing → 'buyer', else 'free'.

Edge functions already importing rentcast: `property-valuation`, `property-valuation-refresh`, `enrich-property`, `owned-property-chat`, `compare-properties-ai`, `property-alerts-evaluate`.

**ATTOM Data deferred** — see comment above `get_market_stats` tool in `investor-chat/index.ts`. Revisit when MRR > $25K or users explicitly need MLS-grade comps.

**Out of scope (intentional):** owned-property-chat tool-wiring (no tool framework there — property value already injected into prompt context); free-tier RentCast access (stays on Perplexity).