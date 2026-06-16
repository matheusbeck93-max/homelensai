# Chrome Extension Macro Badge — Scope

Goal: when the extension detects a property listing, show a compact "Macro" badge in the popup with metro-level labor + housing + rate context, sourced from the same BLS/FRED tools used by the investor brief.

## What the user sees

A new card at the top of the popup (above the chat), shown only when `propertyData.city` + `state` are present:

```text
┌─ Macro snapshot — Tampa, FL ──────────────┐
│ Unemployment  3.6%   per BLS              │
│ Wage YoY      +4.1%  vs price +6.2% (gap) │
│ Mortgage 30y  6.52%  per FRED (live)      │
│ HPI YoY       +5.8%  per FHFA             │
│ source: BLS + FRED · cached 12m ago       │
└───────────────────────────────────────────┘
```

Loading skeleton on first open, error → card hidden silently (don't block chat).

## Architecture

New edge function `extension-macro-badge` (thin aggregator) so the extension makes one call instead of four, and so we don't expose individual tool endpoints. It reuses existing shared tools — no new BLS/FRED logic.

```text
popup.tsx
  └─ <MacroBadge city state />
       └─ fetch /functions/v1/extension-macro-badge?city&state
            └─ Promise.all([
                 runGetMetroLaborMarket,
                 runGetMetroWageGrowth,
                 runGetMetroHousingIndex,
                 runGetCurrentMortgageRates,
               ])
            └─ returns { labor, wage, hpi, rate, cachedAt }
```

## Files

New:
- `supabase/functions/extension-macro-badge/index.ts` — Zod-validated `{city, state}`, calls the 4 macro tools in parallel, returns a flat JSON payload. Uses shared CORS + JWT validation. 30s edge response cache header.
- `chrome-extension/components/MacroBadge.tsx` — presentational card, skeleton + error states, semantic tokens only.
- `chrome-extension/lib/fetchMacroBadge.ts` — typed fetch wrapper with `chrome.storage.session` cache keyed by `${city}|${state}` (TTL 30 min, matches FRED cache horizon).

Edited:
- `chrome-extension/popup.tsx` — mount `<MacroBadge>` when `pendingProperty?.city && state` exist; hide on auth-gated empty state.
- `chrome-extension/manifest.json` — no permission changes needed (already has `storage` + host perms for our Supabase URL).

## Caching & cost control

- Per-session cache in `chrome.storage.session` so reopening the popup or revisiting the tab is free.
- Server-side: piggybacks on existing FRED 24h cache + BLS prefetch cron — no new BLS daily call pressure for top-15 metros. Non-prefetched metros add ~2 BLS calls per first view (labor + wage). Stays well under the 500/day BLS cap with a key.
- Telemetry: reuse the existing `bls_coverage_gap` warn pattern when labor/wage come back null.

## Out of scope (deferred)

- In-page badge injection on listing sites (separate content-script work).
- Macro context inside the AI chat replies (already covered by `ai-chat` tool routing).
- Per-metro Census prefetch (still deferred per earlier decision).

## Effort

~0.5 day: new edge function + 2 small extension files + popup wiring + manual QA on Zillow/Redfin/Realtor.
