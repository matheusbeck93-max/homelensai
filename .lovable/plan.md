# Open House Finder — Production Fix Plan

Shipped feature returns empty results in production. Five fixes, prioritized. Delivered as 4 PRs.

---

## PR A — Data source overhaul (CRITICAL, unblocks everything)

**Goal:** Stop relying on direct Firecrawl scrapes of Redfin/Realtor. Use Perplexity Sonar as primary (handles bot detection, already wired in `perplexity-chat`), Firecrawl as fallback.

**Files**
- `supabase/functions/_shared/openHouses/searchClient.ts` — split into orchestrator + two providers, or add a sibling `dataSources.ts`:
  - `searchOpenHousesViaPerplexity(filters)` — calls Perplexity Sonar with a structured query, then uses Gemini (via Lovable AI Gateway, our default) to extract structured JSON matching the schema. Avoids adding Sonnet/Anthropic dependency.
  - `searchOpenHousesViaFirecrawl(filters)` — existing logic, kept as fallback.
  - `searchOpenHouses(filters)` — Perplexity first; if `< 3` listings or throws, run Firecrawl and merge/dedupe by `listing_url` + normalized address.
- `supabase/functions/_shared/openHouses/types.ts` (or wherever the Zod schema lives) — loosen schema: only `address` and `open_house_starts_at` required; everything else optional; add `confidence: 'high'|'medium'|'low'` default `medium`; post-validation filter drops low-confidence rows missing price/beds.
- `supabase/functions/open-houses-search/index.ts`:
  - Don't cache empty results (`listings.length === 0` → skip insert into `open_house_cache`).
  - Accept `bypass_cache: boolean` in body; when true, skip cache lookup.
  - Add structured logging at each stage: request received, cache hit/miss, perplexity result count, firecrawl result count, zod valid/rejected counts, final count.
- `src/hooks/useOpenHouseSearch.tsx` — pass-through `bypassCache` option.
- `src/pages/OpenHouses.tsx` — add a "Refresh results" button that calls the hook with `bypassCache: true`; add an honesty banner: "Best-effort web search from Zillow, Redfin, and Realtor.com — verify each on the source page."

**SQL (one-time, via insert tool)**
```sql
delete from open_house_cache
where jsonb_array_length(coalesce(results->'listings','[]'::jsonb)) = 0;
```

**Deploy:** `open-houses-search` edge function.

---

## PR B — Tier pricing source of truth

**Goal:** Eliminate `$4.97` everywhere; Buyer is `$9.97`, Investor is `$24.97`. Prevent regression.

**Files**
- `src/lib/tierPricing.ts` (new) — single export:
  ```ts
  export const TIER_PRICING = {
    free:     { display_name: 'Free',     monthly_price: 0,     annual_price: 0 },
    buyer:    { display_name: 'Buyer',    monthly_price: 9.97,  annual_price: 107.64 },
    investor: { display_name: 'Investor', monthly_price: 24.97, annual_price: 239.71 },
  } as const;
  ```
- Run `rg -n '4\.97|9\.97|24\.97|Premium.*4|Buyer.*4' src supabase chrome-extension` and replace every hit with `TIER_PRICING[...].monthly_price` (or remove if dead copy).
- Update tier-gate table in `/open-houses` and any pricing surfaces (`/pricing`, console plan tab, upgrade modals, email templates) to read from `TIER_PRICING`.
- Add a vitest unit test `src/lib/__tests__/tierPricing.guard.test.ts` that walks `src/**/*.{ts,tsx}` (excluding `tierPricing.ts` + tests), greps for literal `$4.97`/`$9.97`/`$24.97`, and fails if found.

---

## PR C — Chrome extension wiring

**Goal:** Open-house queries work in the extension popup chat.

**Files**
- `supabase/functions/ai-chat/index.ts` — in the extension branch, register `findOpenHousesTool` from `_shared/openHouses/tool.ts` in the tool list; also run `detectOpenHouseIntent` early-intercept (same pattern as other chat surfaces) and return a `tool_result_card` payload when matched.
- `chrome-extension/` popup chat renderer — handle the `tool_result_card` payload with `type: 'open_house_cards'` and render `OpenHouseCard` (or a lightweight extension-side equivalent if cross-import is heavy). Reuse via the existing shared-path mechanism already used for `detectMismatches`.
- Rebuild extension zip into `public/`.

**Verify:** popup → "open houses this weekend in Austin" → cards render with time badge, click opens listing URL in new tab.

---

## PR D — Cron install + convention fix

**Goal:** Daily/weekly digests actually fire.

**Migration (uses `supabase--insert`, not migration tool — contains project URL + secret reference):**
```sql
select cron.schedule(
  'open-house-digest-daily', '0 11 * * *',
  $$select net.http_post(
    url := 'https://yckcdxtatwolzilboahx.supabase.co/functions/v1/send-open-house-digest',
    headers := jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_shared_secret'))
  );$$
);
select cron.schedule(
  'open-house-digest-weekly', '0 22 * * 5',
  $$select net.http_post(
    url := 'https://yckcdxtatwolzilboahx.supabase.co/functions/v1/send-open-house-digest?frequency=weekly',
    headers := jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_shared_secret'))
  );$$
);
```
Verify with `select * from cron.job where jobname like 'open-house-digest%';` and a manual curl to `send-open-house-digest`.

Delete `src/lib/openHouseDigestCron.sql` (now applied).

---

## Diagnostic step (before/after)

Already covered by logging added in PR A. After deploy, trigger Austin/this-weekend test and read `supabase--edge_function_logs` for `open-houses-search` to confirm Perplexity is primary and listings > 0.

---

## Technical notes

- **Structured extraction model:** use Gemini 2.5 Flash via Lovable AI Gateway (per project memory — primary model, no extra key). Avoids introducing Anthropic Sonnet as the fix prompt suggested.
- **Perplexity already wired:** `PERPLEXITY_API_KEY` secret present; reuse the call pattern from `perplexity-chat` edge function.
- **Cache key:** keep existing `filter_hash` scheme; just gate the write on non-empty.
- **Dedup:** normalize `listing_url` (strip query) + lowercase trimmed address as the dedup key.
- **No schema changes** to `open_house_cache` / `open_house_alerts` required.

---

## Out of scope (confirmed)
Virtual-only filter, .ics export, push notifications, MLS integration.

---

## Order of execution
1. PR A (data source) — fixes the broken feature
2. PR B (pricing) — embarrassing regression
3. PR D (cron) — small, unblocks alerts
4. PR C (extension) — last, depends on stable backend

Approve and I'll start with PR A.