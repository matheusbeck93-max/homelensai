## Part 1 — Audit Report

**State: ⚠️ Partially integrated** (closer to "live core, missing AI/quota layer" than stub).

| Check | Result |
|---|---|
| `RENTCAST_API_KEY` secret | ✅ Present |
| `_shared/rentcast.ts` adapter | ✅ Exists (139 lines, sale + rent AVM in parallel) |
| `investor_owned_property_valuations` table | ✅ Exists with `source` column |
| Rows with `source = 'rentcast'` | ✅ 19 rows, most recent today |
| `property-valuation` / `property-valuation-refresh` edge funcs | ✅ Writing valuations |
| Callers (`enrich-property`, `owned-property-chat`, `compare-properties-ai`, `property-alerts-evaluate`) | ✅ Importing the adapter |
| AI tool `compare_rent_to_market` | ❌ Missing |
| AI tool `estimate_property_value` (chat-callable) | ❌ Missing — only background refresh exists |
| Daily per-user quota (5 buyer / 50 investor) | ❌ Not enforced |
| Dedicated `rentcast_cache` + `rentcast_usage_log` tables | ❌ Don't exist (valuations table acts as de-facto value cache via `observed_at`) |
| Override-respect on refresh | Verify (Out of scope for this PR — already specced in My Properties prompt) |

**Conclusion:** Core auto-valuation pipeline is live. What's missing is the explicit AI tool surface, the quota/cache guardrails the prompt calls for, and the ATTOM deferral note. Proceeding to a scoped Part 2 + Part 3.

---

## Part 2 — Close the gaps (RentCast hardening + AI tools)

### 2A. Database — caching + usage ledger (one migration)

```text
public.rentcast_cache
  cache_key TEXT PRIMARY KEY        -- e.g. "value:<address-hash>", "rent:<address-hash>", "details:<address-hash>"
  endpoint  TEXT NOT NULL            -- 'value' | 'rent' | 'comps' | 'details'
  payload   JSONB NOT NULL
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
  expires_at TIMESTAMPTZ NOT NULL    -- value/rent: +24h, details: +7d, comps: +24h
  -- RLS: no client access; service_role only.

public.rentcast_usage_log
  id UUID PK
  user_id UUID NOT NULL REFERENCES auth.users
  endpoint TEXT NOT NULL
  cache_hit BOOLEAN NOT NULL
  called_at TIMESTAMPTZ DEFAULT now()
  -- RLS: user can SELECT own rows; service_role full.
  -- Index on (user_id, called_at) for daily-quota window.
```

Both tables get `GRANT`s per the public-schema rule (service_role full; authenticated SELECT only on usage_log).

### 2B. Adapter upgrades — `supabase/functions/_shared/rentcast.ts`

Add (keeping the existing `fetchRentcastValuation` for the background refresh path that's already working):
- `getValueCached(addr)` / `getRentCached(addr)` — hit `rentcast_cache` first, else call API + persist (24h TTL).
- `getDetailsCached(addr)` — `/properties` endpoint, 7d TTL.
- `getRentalComps(addr, radiusMi, limit)` — `/avm/rent/long-term` with `compCount`, 24h TTL. Returns ranked list (composite: 40% distance / 30% beds-baths match / 30% recency).
- `enforceDailyQuota(userId, tier)` — count today's `rentcast_usage_log` rows for the user, throw a typed `RentcastQuotaError` past `tier === 'investor' ? 50 : 5`. Free tier → throw immediately (use Perplexity instead).
- `logRentcastCall(userId, endpoint, cacheHit)` — fire-and-forget insert.
- Telemetry events `rentcast_call_made` / `rentcast_cache_hit` (use existing tool-call telemetry table if present, else log via `ai_usage_log`).

### 2C. AI tools — wire into `investor-chat` and `owned-property-chat`

In `supabase/functions/investor-chat/index.ts` add two new tool definitions next to `get_market_stats`:

```
estimate_property_value({ address, beds?, baths?, sqft?, propertyType? })
  → { value, low, high, rent, rentLow, rentHigh, source: 'rentcast', cached }
compare_rent_to_market({ address, currentRent, beds?, baths?, sqft? })
  → { marketRent, marketRentLow, marketRentHigh, delta, deltaPct, verdict: 'below'|'at'|'above' }
```

Both tools:
- Call `enforceDailyQuota` with the user's tier (resolve via `profiles.subscription_status`).
- On quota error, return a structured `{ error: 'quota_exceeded', tier, limit }` so the AI can degrade gracefully ("You've hit today's RentCast limit — here's a Perplexity-based estimate instead.").
- On free tier: skip RentCast and fall through to the existing Perplexity path.

Mirror the same two tools into `owned-property-chat` so per-property questions ("Am I under-renting?") work.

### 2D. Cron — daily refresh sweep

`supabase/functions/property-valuation-refresh/index.ts` already exists. Verify it's scheduled; if not, register a daily cron via `supabase--insert` (not migration — contains URL + anon key per project policy). Skip if a `cron.job` for it already exists.

### 2E. Override respect

Quick verification only — `property-valuation-refresh` already gates on `investor_owned_properties.manual_value_override_at`. Confirm and add a regression test note. No code changes unless broken.

---

## Part 3 — ATTOM deferral comment (canonical drop point)

Insert directly above the `get_market_stats` tool definition in `supabase/functions/investor-chat/index.ts` (line ~358 — that's the registry entry where future "should we use a real API?" decisions get made):

```ts
// ATTOM Data deferred — market stats use Perplexity + Sonnet for now.
// Revisit when MRR > $25K OR users explicitly request deeper comps/MLS-grade data.
// Cost reference: ATTOM tiers start at ~$500/mo. RentCast (Foundation, $74/mo)
// handles property valuation + rent estimates. See homelens_rentcast_audit_integration_prompt.md §3.
```

No code change in market-stats logic itself.

---

## Out of scope (per prompt)

- ATTOM integration. MLS licensing. Zillow Bridge / Realtor partner. Manual override UX rebuild. International addresses.
- Free-tier RentCast access (free stays on Perplexity).

## Verification

- Migration applies; `rentcast_cache` + `rentcast_usage_log` exist with grants/RLS.
- `compare_rent_to_market` + `estimate_property_value` resolvable from `investor-chat` and `owned-property-chat`; second call within 24h hits cache and writes a `cache_hit=true` log row.
- Investor account at 51 calls/day hits `quota_exceeded`; buyer at 6 calls/day hits it.
- ATTOM comment present above `get_market_stats`.
- Existing 19 rentcast valuation rows untouched; refresh keeps writing new rows.

## Surfaces to deploy

`investor-chat`, `owned-property-chat`, `property-valuation`, `property-valuation-refresh`, plus shared module touched.

## Memory updates after build

Add a memory entry under "Properties & Market Data" pointing at this audit's outcome (live + tier/cache contract) so the next session doesn't re-audit.
