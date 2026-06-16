# FRED + Census + BLS Macro Intelligence Layer

Adds three free public-data sources (FRED, Census ACS + Permits, BLS) as first-class AI tools so canonical macro / demographic / labor questions stop routing to Perplexity. Wires into every chat surface, briefs, anniversary reports, smart alerts, and the contextual follow-ups registry built in the prior PRs.

## Open questions before kickoff

1. **Secrets**: `FRED_API_KEY`, `CENSUS_API_KEY`, `BLS_API_KEY` are not in the project's secret list. I'll request them via `add_secret` at the start of each respective PR. Confirm you have all three (or which need signup links surfaced in PR descriptions).
2. **Pedro decisions in Part 12** — I'll apply the *Recommend* defaults unless you say otherwise:
   - 20-city Case-Shiller only (FHFA later); rate alerts to all tiers with saved properties; ZIP as primary geo; freeze rate snapshot at brief generation; growth-signal match weight behind feature flag (A/B 5% vs 10%); anniversary baseline = first saved property; non-20 metros fall back to national index with note; affordability shows single + dual side-by-side; BLS prefetch = union of top-15 user-concentration metros + 20 Case-Shiller metros (~25); labor-shift alerts Investor-only at launch.

## Scope per PR

### PR 1 — FRED foundation
- Add secret `FRED_API_KEY`.
- `supabase/functions/_shared/fred-series.ts` — series catalog + Case-Shiller metro map + city→series resolver with national fallback.
- Migration: `fred_cache(series_id pk, payload jsonb, cached_at, ttl_minutes)` + index; GRANTs to `service_role` only; RLS enabled, no public policies (server-only cache).
- `supabase/functions/fred-get-series/index.ts` — params: `series_id`, `limit`, `observation_start`. Cache-first; computes `latest`, `change_30d/90d/yoy` in basis points. TTLs by frequency (1h/6h/24h/7d).
- `supabase/functions/fred-mortgage-snapshot/index.ts` — bundled 30y/15y rates + Fed funds + 10y + spread + Case-Shiller national + unemployment + CPI + narrative_hint.
- `supabase/functions/fred-prefetch-daily/index.ts` + pg_cron job at 6am ET (insert via supabase--insert, not migration, since it embeds project URL + anon key).
- Smoke tests against live FRED.

### PR 2 — FRED tools + chat/brief wiring
- Register tools in the same dispatch pattern as `FOLLOWUP_TOOLS` (new `supabase/functions/_shared/ai/tools/macro/` directory, `MACRO_TOOLS` export, `runMacroTool` dispatcher).
- Tools: `get_current_mortgage_rates`, `get_rate_environment_analysis`, `get_national_housing_index`, `get_metro_housing_index`, `get_macro_economic_context`. Descriptions include explicit "Prefer over Perplexity when…" clauses.
- Wire into `ai-chat`, `investor-chat`, `owned-property-chat`, `extension-followups`, `investor-brief` (same pattern PR C used for followup tools).
- Brief "Today's rate context" line above financial breakdown; rate snapshot frozen per brief.
- Front-end `Sparkline` component (inline SVG, no chart lib dep) + `SourceAttribution` component.
- Extension overlay rate badge sourced from snapshot.

### PR 3 — Census foundation
- Add secret `CENSUS_API_KEY` (surface signup link in PR description if missing).
- `_shared/census-variables.ts` (ACS variable map) + `_shared/census-geo.ts` (address geocode, ZIP→ZCTA, city→place FIPS, top-500 metro lookup baked in).
- Migration: `census_cache(cache_key pk, payload jsonb, cached_at, ttl_days)` + GRANTs + RLS.
- Edge functions: `census-area-stats` (ZIP/county/address → population/income/housing/education/employment/commute), `census-area-growth` (5-vintage trend + signal classifier high/moderate/flat/declining), `census-building-permits` (state/county, 12m trailing, supply_signal).

### PR 4 — Census tools + Investor + Stickiness + Alerts
- Register `get_area_demographics`, `get_area_growth_trends`, `get_supply_pipeline`; wire all chat surfaces.
- Investor brief macro-context block (rates + Case-Shiller + growth + permits).
- Stickiness: `generate-anniversary-report` and quarterly investor report pull FRED + Census tools; "Then vs Now" block when account age > 30d using first-saved-property baseline.
- Smart alerts (extend existing alerts pipeline): material rate move ≥25 bps, monthly Case-Shiller release.
- Match scoring: area-growth signal + affordability index behind a feature flag column (no UI change).
- Telemetry events: `fred_tool_called`, `census_tool_called`, `macro_context_displayed`, `rate_alert_fired`, `case_shiller_alert_fired`.

### PR 5 — BLS foundation
- Add secret `BLS_API_KEY` (surface signup link if missing; without key only 25 q/day).
- `_shared/bls-series.ts` — measure/metro/sector catalog with top-50 metro code lookup baked in.
- Migration: `bls_cache(cache_key pk, payload jsonb, cached_at, ttl_hours)` + GRANTs + RLS.
- Edge functions: `bls-get-series` (POST bulk, up to 50 series), `bls-metro-snapshot` (LAUS + CES jobs-by-sector + labor_market_signal), `bls-affordability-context` (OEWS wages + current FRED rate → required income + occupations table, single & dual earner).
- `bls-prefetch-daily` cron at 7am ET for ~25 metros (bulk fetches keep us ≤10 API calls/day).
- Daily usage telemetry with 80%-of-limit alert.

### PR 6 — BLS tools + Affordability surface integration
- Register `get_metro_labor_market`, `get_wage_affordability`, `get_metro_wage_growth`.
- Wire into all chat surfaces; system-prompt nudge for Sonnet to chain FRED + Census + BLS for compound questions ("should I buy in Austin?").
- Buyer brief gets local-affordability block (BLS).
- Investor macro-context extended with labor-market line.
- Smart alert: labor-market shift (Investor-tier only).
- Contextual follow-ups registry (from prior PR) gains a 6th topic: **"Who can afford this locally?"** → cascade collects metro + price → calls `get_wage_affordability`. Updates `followupRegistry.ts`, `triggerDetection.ts`, `FOLLOWUP_CASCADE_PROMPT_BLOCK`.

## Technical notes

- **Tool dispatch**: mirror the existing `FOLLOWUP_TOOLS` / `runFollowupTool` pattern from `supabase/functions/_shared/ai/tools/followups/index.ts`. Each surface (`ai-chat`, `investor-chat`, `owned-property-chat`) gets one additional spread in its `tools` array and one additional branch in the tool-call dispatch loop. No rewrites of those files.
- **Caching**: all three cache tables are server-only (`service_role` GRANT, RLS enabled with no policies). Edge functions use service-role client for reads/writes.
- **Cron jobs**: created via `supabase--insert` (not migration) because the SQL embeds project URL + anon key.
- **Rate-limit safety**: FRED 120/min and BLS 500/day enforced at the edge-function layer with exponential backoff on 429; cache-first means we'll be well under in practice.
- **Source attribution**: shared `<SourceAttribution>` component used in chat bubbles, briefs, and emails — never display a number without the source label.
- **Failure mode**: every tool is fail-soft (returns `{ ok: false, error, fallback_hint }`) so the LLM degrades to Perplexity narrative instead of crashing the turn — same contract as the followup tools.

## Verification (run before each PR merge)

Items 1–17 from Part 11 of the prompt — I'll execute them via `supabase--curl_edge_functions` and capture results in each PR description. Production smoke run after PR 2 (FRED live in chat), PR 4 (Census live + alerts), and PR 6 (BLS live + affordability brief block).

## Out of scope (Part 13 — deferred)

FRED Regional Data, Census migration flows, BLS QCEW/JOLTS, Housing Vacancies Survey, FHFA HPI. Logged for future expansion.

---

**Total: 6 PRs, ~7 days.** PR 1 unblocks 2; PR 3 unblocks 4; PR 5 unblocks 6. PRs 1, 3, 5 can run in parallel if you want to compress the timeline — each is independent until its tool-registration sibling.
