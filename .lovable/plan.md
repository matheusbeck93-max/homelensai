## Stage 1 — Owned-property-chat parity + Free contract + verification (this PR)

### 1. Free-tier contract: "upgrade prompt only"
- `_shared/rentcast.ts`: keep `RentcastQuotaError` for buyer/investor at-limit. Add a sibling `RentcastUpgradeRequiredError` thrown when `tier === 'free'`. Update `enforceDailyQuota` to throw the upgrade error for free, the quota error for paid-at-limit.
- Tool `execute` blocks (both tools in `investor-chat`) map errors to two distinct shapes:
  - `{ error: 'upgrade_required', tier: 'free', cta: 'Upgrade to Buyer or Investor for live RentCast valuations.' }`
  - `{ error: 'quota_exceeded', tier, limit, resetIn: '24h' }`
- Tool descriptions updated: "On `upgrade_required`, do NOT fabricate a number. Reply with a one-line upgrade nudge and offer market-level context via `get_market_stats`. On `quota_exceeded`, tell the user they've hit today's RentCast cap and offer the same fallback."

### 2. Owned-property-chat: native tool framework
- Port the loop from `investor-chat/index.ts` lines 1345–1660 into `owned-property-chat`:
  - `ExecutionContext` carrying `userId`, `serviceSupabase`, `property` (owned-property record), `propertyAddress`.
  - `TOOLS` registry with the two RentCast tools + a new `get_owned_property_comps` placeholder commented for future RentCast `/listings/rental` wiring.
  - OpenAI-compatible tool-call loop using `callAiGateway` (already used). Cap at 4 turns.
- Pre-fill tool args from `property` context so the model rarely needs to ask address again: defaults injected when args are missing.
- Memory injection (parity with investor-chat intuitive-conversation fix): query `user_memories` for `user_id = ctx.userId AND scope IN ('global','owned_property')`, append top 10 by recency under a `--- USER MEMORY ---` block in the system prompt.
- Smoke check: ask "show me 3 comparable rentals near 1814 Cedar" → tool fires, result renders.

### 3. Tests
- New `supabase/functions/_shared/__tests__/rentcast_test.ts`:
  - `resolveRentcastTier` table test: investor price IDs → investor; active/trialing → buyer; everything else → free; missing profile → free.
  - `enforceDailyQuota` boundary test with a stub Supabase client (count = 4/5 → ok; count = 5/5 buyer → throws quota; count = 50/50 investor → throws quota; tier = free at count 0 → throws upgrade).
  - Run via `supabase--test_edge_functions`.

### 4. Live smoke (curl)
- Hit deployed `investor-chat` as the preview-logged-in user with: "estimate value at 1814 Cedar Ave, Tampa FL 33602, 3bd/2ba/1450 sqft". Confirm tool call + cached result in logs.
- Read `rentcast_usage_log` for the user, confirm one fresh + one cache_hit row when the query repeats.
- Document free-tier behavior by temporarily downgrading a test user (or reading the `free` branch in unit test only — we will NOT log out and create a fresh user just for this).

### 5. ATTOM deferral comment parity
Add the same `// ATTOM Data deferred …` comment block above the market-stats tool registration in `owned-property-chat` (when added) and in `ai-chat` near the firecrawl analysis branch, so the deferral is visible in every surface that could otherwise grow an MLS-comp call site.

---

## Stage 2 — Remaining surface parity (separate PR)

### Surface matrix
| Surface | Today | Stage 2 plan |
|---|---|---|
| `investor-chat` | Tools live ✅ | — |
| `owned-property-chat` | Stage 1 ✅ | — |
| `ai-chat` (firecrawl + extension branches) | Tool loop exists via `completeWithFallback`; no RentCast tools | Add the two tools to the `routerTools` array on both router-gated branches. Free users get same `upgrade_required` contract; extension branch surfaces a compact "Upgrade for live AVM" inline. |
| `property-assistant` | No tool loop | Add a minimal single-pass tool loop OR explicitly delegate via system-prompt rule ("If the user asks for a value or rent estimate, instruct them to use the Investor Console which has live AVM access"). Decision needed at start of Stage 2. |
| `brief` Deep Dive | (file not yet located — `investor-brief`) | Audit `investor-brief` for an existing tool/agent loop. If present, register the two tools there. If not, add a one-off "value estimate" enrichment step that runs before the brief is rendered (background, not chat). |
| Chrome extension | Calls `ai-chat` with `extensionMode: true` | Inherits Stage 2 ai-chat changes automatically. No separate extension code change needed unless we want a dedicated CTA component. |

### Shared helper extraction
- Move `resolveRentcastTier` into `_shared/rentcast.ts` so all four surfaces use one definition (currently inlined in `investor-chat`). Update `investor-chat` to import it.
- Move the two tool definitions (`estimate_property_value`, `compare_rent_to_market`) into `_shared/rentcast-tools.ts` with a `buildRentcastTools(ctx)` factory. Stage 1 still inlines them in owned-property-chat to keep that PR self-contained; Stage 2 refactors.

### Free-fallback clarification
- Final contract (applies to all surfaces): Free users never call RentCast. Tool returns `{ error: 'upgrade_required', cta }`. Model replies with a single sentence: *"Live property valuations need a Buyer or Investor subscription. Want a market-level estimate instead?"* and offers `get_market_stats` for the area.
- No Perplexity fallback for AVM — Perplexity stays for market trends + neighborhood narrative only.

### 7-day cache hit rate instrumentation
- Add a small SQL view `rentcast_cache_hit_rate_7d`:
  ```sql
  CREATE VIEW public.rentcast_cache_hit_rate_7d AS
  SELECT
    date_trunc('day', called_at) AS day,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE cache_hit) AS hits,
    ROUND(100.0 * COUNT(*) FILTER (WHERE cache_hit) / NULLIF(COUNT(*),0), 1) AS hit_rate_pct
  FROM public.rentcast_usage_log
  WHERE called_at >= now() - interval '7 days'
  GROUP BY 1 ORDER BY 1 DESC;
  ```
- Report check-in: I'll add a `.lovable/memory` reminder dated +7 days to re-run `SELECT * FROM rentcast_cache_hit_rate_7d` and confirm > 70%.

---

## Why two stages
- Stage 1 alone is ~400 lines new code + tests + smoke and is independently shippable: it closes the owned-chat gap (the highest-friction surface) and locks the Free contract before more callers depend on it.
- Stage 2 has open design choices (property-assistant: tool loop vs. delegate; brief Deep Dive: location TBD) that benefit from a quick decision pass before coding.

Approve Stage 1 to start coding; I'll surface Stage 2 design choices when Stage 1 is verified.
