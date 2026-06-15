
## Stage 2 update (2026-06-15)
- New helper: `_shared/rentcast-enrichment.ts` exposes `fetchRentcastEnrichmentBlock(svc, userId, addr)`. Single-shot, cached value+rent lookup that returns a model-ready MARKET DATA string or `null`. Never throws; silent on free / quota / failure. For one-pass surfaces only — chat surfaces with tool loops keep using `getValuationCached` + the tool framework.
- `ai-chat` firecrawl branch (single-URL) and extension branch now inject the RentCast block into the analysis prompt for buyer/investor tiers. Free tier gets no block (no upgrade nudge here — that's the chat surfaces' job). Multi-URL firecrawl comparison: intentionally skipped to avoid multiplying quota usage.
- `property-assistant` does NOT call RentCast (no tool loop, no enrichment). System prompt now tells it to redirect "what's my house worth" style questions to My Properties / Investor Console once per turn, then answer the rest from general knowledge.
- `investor-brief` Deep Dive: NOT wired. It's a card-based prose generator, not a chat surface; the cards already carry the RentCast numbers when relevant. Revisit only if a "live valuation card" is added.
- 7-day cache hit rate view: `public.rentcast_cache_hit_rate_7d` (security_invoker). Re-check at +7 days from 2026-06-15 → target >70%. Query: `SELECT * FROM public.rentcast_cache_hit_rate_7d;`

## Stage 1 update (2026-06-15)
- `resolveRentcastTier` lives in `_shared/rentcast.ts` — single source of truth.
- Free tier throws `RentcastUpgradeRequiredError`; tools return `{ error: 'upgrade_required', cta }`. No Perplexity AVM fallback for free users.
- `owned-property-chat` has its own raw-fetch tool loop (MAX 4 iterations) with `estimate_property_value` + `compare_rent_to_market`, pre-filled from PROPERTY CONTEXT. Injects top 10 `user_memories`.
- Tool descriptions ALWAYS lead with "SUCCESS: use the numeric fields" before the error branches — Gemini otherwise utters upgrade text on successful cached calls.
- Boundary tests live in `supabase/functions/_shared/__tests__/rentcast_test.ts` (13 passing).
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