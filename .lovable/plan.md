## Macro Intelligence Layer — Production Hardening PR

Closes the five production gaps from the polish list plus the prefetch cron and post-deploy verification hooks. Scoped as one focused follow-up PR (~1 day).

---

### 1. BLS API key (required, not optional)

- Request `BLS_API_KEY` secret via `secrets--add_secret` (user registers at data.bls.gov/registrationEngine, ~30 sec).
- Update `_shared/bls-client.ts` to send `registrationkey` in every POST body when present; log a single warning on cold start if missing.
- Raise per-key rate budget assumption from 25/day → 500/day; remove "optional" wording from comments and the integration doc note.

### 2. Census geocoder — fuzzy city fallback

In `_shared/census-geo.ts`:
- When the Census Geocoder `onelineaddress` lookup returns zero matches for a city-only query, fall back to the Census `places` benchmark (`/geographies/onelineaddress?benchmark=Public_AR_Current&vintage=Current_Current`) before degrading to state.
- Add a normalized-name lookup against a small hand-curated alias map (top 100 metros + common variants like "NYC", "LA", "DFW", "DMV") that resolves to canonical `"<City>, <ST>"` before hitting the Census API.
- Only degrade to state-level if both lookups fail; tag the result with `geoLevel: "place" | "county" | "state"` and surface it in the tool response so the AI can disclose granularity.
- Unit test cases: Austin, Miami, Brooklyn, "the DMV", "Silicon Valley".

### 3. Per-metro building permits (BPS)

Rewrite `getBuildingPermits.ts` to call the Census BPS (Building Permits Survey) MSA endpoint instead of national totals:
- Resolve metro → CBSA code via a static top-50 MSA → CBSA map in `_shared/census-geo.ts` (extend the existing metro list).
- Hit `https://api.census.gov/data/{year}/eits/bps` with `for=metropolitan+statistical+area/micropolitan+statistical+area:{cbsa}` and `get=...` for total units permitted, single-family, multi-family.
- Cache in `census_cache` with 7-day TTL (BPS releases monthly).
- Fall back to national total only if no CBSA resolves, and flag `scope: "national_fallback"` in the response.

### 4. Wage-affordability tool routing

Two reinforcements so the AI consistently picks `get_wage_affordability` for affordability intents:
- **System prompt nudge** in `ai-chat`, `investor-chat`, `owned-property-chat`: add a short routing rule — "For any question about who can afford a home, local incomes vs prices, household-income-to-mortgage gap, or 'can locals afford this', call `get_wage_affordability` BEFORE answering. Do not estimate from training data."
- **Followup registry downrank**: in `followupRegistry.ts`, when the affordability topic matches, ensure the tool-call path takes precedence over the generic Perplexity text path (set higher priority / earlier match in the registry order).
- Add a one-shot example in the tool description showing the expected input shape (city + listing price) to reduce malformed calls.

### 5. Ship `get_metro_wage_growth` (third BLS tool)

New tool `_shared/ai/tools/macro/getMetroWageGrowth.ts`:
- Pulls BLS QCEW or OEWS year-over-year average weekly wage change for a given metro (CBSA).
- Returns `{ metro, currentWage, yoyChangePct, periodStart, periodEnd, source: "BLS QCEW" }`.
- Compare to local FRED Case-Shiller metro HPI YoY (reuse `getMetroHousingIndex`) inside the tool to compute a `wageVsPriceGap` field — the answer to "are wages keeping up with home prices here?".
- Register in `_shared/ai/tools/macro/index.ts` and the three chat edge functions.
- Add a followup chip in `followupRegistry.ts`: "Are wages keeping up with home prices here?"

### 6. Weekly BLS prefetch cron

- New edge function `bls-prefetch-weekly` that warms BLS labor market + wage-growth series for the top 15 metros (subset of the existing top-20 list).
- Schedule via `pg_cron` + `pg_net` using `supabase--insert` (per the schedule-jobs guidance), Sundays 03:00 UTC.
- Writes into `bls_cache` with the standard 7-day TTL.
- Mirrors the existing `fred-prefetch-daily` pattern.

### 7. Investor brief — include BLS labor data

Update `investor-brief/index.ts` macro snapshot ingest to also include, per target market:
- Unemployment rate + 12mo trend (BLS LAUS)
- Avg weekly wage + YoY change (new wage growth tool)
- Wage-vs-price gap

Add a one-line LLM instruction: "When discussing affordability or local demand, cite the BLS wage and unemployment figures verbatim with 'per BLS'."

### 8. Post-deploy verification

Three checks to confirm before sign-off (run from chat after 48h):
- **(a) BLS in investor brief**: regenerate a brief for a top-20 metro; assert the rendered brief contains BLS-cited unemployment and wage lines.
- **(b) FRED cache hit rate >90%**: add a lightweight counter (`fred_cache` hits/misses logged to `tool_call_telemetry`) and a short SQL query the user can run to confirm `hits / (hits+misses) > 0.9` over the prior 48h.
- **(c) BLS daily call count under control**: same telemetry pattern for BLS; query confirms <100 calls/day with the key in place.

---

### Deferred (explicitly out of scope)

- Chrome extension macro badge.
- Per-metro Census ACS prefetch (FRED + BLS prefetch is enough for now).

### Technical details

- **Files created**: `supabase/functions/_shared/ai/tools/macro/getMetroWageGrowth.ts`, `supabase/functions/bls-prefetch-weekly/index.ts`.
- **Files edited**: `_shared/bls-client.ts`, `_shared/census-geo.ts`, `_shared/ai/tools/macro/getBuildingPermits.ts`, `_shared/ai/tools/macro/index.ts`, `ai-chat/index.ts`, `investor-chat/index.ts`, `owned-property-chat/index.ts`, `investor-brief/index.ts`, `src/lib/conversationalIntelligence/followupRegistry.ts`.
- **Secrets**: add `BLS_API_KEY` (user-provided).
- **Cron**: created via `supabase--insert` (not migration) per project convention.
- **No schema changes** — reuses existing `bls_cache`, `census_cache`, `fred_cache`, `tool_call_telemetry` tables.

### Order of execution

1. Request `BLS_API_KEY` secret → wait for user.
2. Land BLS client key wiring + `get_metro_wage_growth` + brief integration.
3. Census geocoder fuzzy fallback + BPS per-metro rewrite.
4. Tool-routing nudges (system prompts + registry).
5. Weekly prefetch cron.
6. Telemetry counters for verification checks.
