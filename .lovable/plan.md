## Problem

`/open-houses` for Tucson, AZ returned **0 results**. Edge logs confirm both data sources came back empty:

```
perplexity extraction { raw_count: 0 }
firecrawl extraction { raw_count: 0 }
orchestrator result { primary: "none", total: 0 }
```

The web call is firing. The pipeline is collapsing somewhere between Perplexity's prose answer and the Gemini JSON extractor. Today we don't log enough to know exactly where — fix that first, then loosen the parts most likely to be silently dropping listings.

## Changes

### 1. Add visibility (edit `supabase/functions/_shared/openHouses/dataSources.ts`)
- Log Perplexity answer length, citation count, and a 300-char preview before extraction.
- Log Gemini raw response length + a 300-char preview when `raw_count === 0`.
- Log Firecrawl HTTP status + body preview when it returns 0.

### 2. Loosen Perplexity query
- Drop `search_recency_filter: 'week'` (excludes any portal page indexed >7 days ago).
- Add the current date range plainly in the prompt instead of relying on the recency filter.
- Ask explicitly for Zillow/Redfin/Realtor URLs, one home per line — easier for the extractor.

### 3. Make Gemini extraction more forgiving
- Strip leading ```json fences before `JSON.parse`.
- If `response_format: json_object` fails, retry once without it and parse the first JSON block.
- Soften `isValidListing`: keep any row with an address + listingUrl, even if price/beds are missing (we already render gracefully when those are null).

### 4. Improve Firecrawl fallback
- Add `bypass: true` style behavior by switching Redfin/Realtor to their *open-houses* search pages with explicit date params, and try Zillow open-house URL as a third source.
- Don't fail silently — surface non-2xx body in logs.

### 5. UX: show *why* zero results came back
- In `OpenHouses.tsx` empty state, when the API responds with `listings: []`, show a one-line note: "No open houses surfaced for this city/date window. Try a wider date range or remove the price floor." Today the UI just collapses back to the default empty pitch, which makes the feature feel broken.

## Out of scope
- No schema changes, no new tables, no quota changes.
- Free-tier limit (5/day) untouched.
- Cache TTL untouched.

## Verification
1. Redeploy `open-houses-search`.
2. Re-run the Tucson AZ search from the preview.
3. Read edge logs to confirm Perplexity prose is non-empty and either listings are extracted, or the new logs pinpoint exactly which step is dropping them.
4. If still 0 after loosening, the new logs tell us whether it's Perplexity (no prose) or Gemini (prose but no JSON) — then we patch that single layer.
