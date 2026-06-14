# Open House Finder

Discover upcoming open houses (US + Canada) via Firecrawl-scraped Redfin/Realtor data, accessible through every chat surface AND a dedicated map+list page, with tiered limits and optional email alerts for saved searches.

## Scope

### 1. Data layer (Firecrawl scrape)
New edge function `open-houses-search` that:
- Accepts `{ country, state, city, dateFrom, dateTo, priceMin, priceMax }`
- Builds Redfin and Realtor.com open-house URLs (e.g. `redfin.com/city/.../filter/include=open-house`, `realtor.com/realestateandhomes-search/.../show-open-house-only`)
- Calls Firecrawl `scrape` with `formats: ['json']` + schema extracting: address, price, beds/baths, sqft, lat/lng, photo, listing URL, open house date/time windows
- Normalizes to `HomeLensProperty` extended with `openHouses: [{ start, end, type: 'in-person' | 'virtual' }]`
- 30-min cache in new `open_house_cache` table (key = filter hash), stale-while-revalidate
- Fallback chain: Redfin → Realtor → empty result with friendly message

### 2. Dedicated page `/open-houses`
- Header pt-24, no back button
- Filter bar: Country toggle (US/Canada), State/Province dropdown, City autocomplete (extend `usStatesCities` + add Canadian provinces/cities), Date chips (Today / This weekend / Next 7 days / Custom), Price range
- Split layout: left = scrollable card list with prominent open-house time badge, right = Mapbox map with pins (reuse `MAPBOX_PUBLIC_TOKEN`)
- Mobile: tabs to swap list/map
- Cards link to existing `/property/:id`
- "Save this search for alerts" CTA (Buyer/Investor tier)

### 3. Unified chat integration — ALL chat surfaces
A single shared tool `find_open_houses` (defined in `_shared/openHouses/tool.ts`) wired into every chat entry point so users can ask "open houses near Austin this weekend" anywhere:

| Surface | File | Integration |
|---|---|---|
| Regular chat | `supabase/functions/ai-chat/index.ts` | Add to tool registry, render via existing PropertyCard UIBlock |
| Investor chat | `supabase/functions/investor-chat/index.ts` + `src/lib/investorChat/calcEngine.ts` | Add as agent tool; results inline in stream |
| Property assistant | `supabase/functions/property-assistant/index.ts` | Add tool (helps users compare to current listing's neighborhood) |
| Owned property chat | `supabase/functions/owned-property-chat/index.ts` | Add tool (find comps with open houses) |
| Perplexity chat engine | `supabase/functions/perplexity-chat/index.ts` | Detect open-house intent → route to `open-houses-search` first, then summarize via Perplexity for natural-language reply |
| Chrome extension | `chrome-extension/background.ts` dual-route + `supabase/functions/extension-followups/index.ts` | Add same tool; popup shows results as compact cards |
| Preferences chat | `supabase/functions/preferences-chat/index.ts` | Add tool so AI can demo by surfacing open houses matching saved prefs |

All surfaces share:
- Same `find_open_houses` schema/validator
- Same tier-gate check (free daily counter)
- Same UIBlock card output for visual consistency
- Same MATCH_SCORE prefix contract preserved on regular/property chat

### 4. Tier gating
| Tier | Open House Search | Map View | Saved Alerts |
|---|---|---|---|
| Free | 5 searches/day, max 10 results | Yes | 0 |
| Buyer ($4.97) | Unlimited | Yes | 3 saved cities |
| Investor (Premium) | Unlimited | Yes | 10 saved cities + weekly digest |

Enforced via existing `_shared/tierGate.ts`. Free counter in `profiles.daily_open_house_searches` (resets daily, same pattern as `daily_analysis_count`). Counter increments across ALL surfaces (page + every chat) using shared `_shared/openHouses/limiter.ts`.

### 5. Email alerts
- New table `open_house_alerts` (user_id, country, state, city, filters jsonb, frequency: 'daily' | 'weekly', last_sent_at, enabled)
- Reuse Resend via `_shared/email/sender.ts` (verified `homelensais.com`)
- New template `_shared/email/templates/openHousesDigest.ts`
- New edge function `send-open-house-digest` triggered by pg_cron:
  - Daily 11:00 UTC (7am ET) — "Today's open houses"
  - Weekly Friday 22:00 UTC (6pm ET) — weekend digest
- Toggle `email_preferences.open_house_digest BOOLEAN DEFAULT true`
- One-click unsubscribe via existing token system

### 6. Navigation
- Add `Open Houses` link in `Header` main nav
- `/console` Overview card: "Saved Open House Alerts" with count + manage link
- New informative chip on `/chats` empty state: "Find open houses in [your city] this weekend"

## Technical details

**New tables (single migration):**
- `open_house_cache` — filter_hash (PK), country, state, city, results jsonb, fetched_at
- `open_house_alerts` — user_id, country, state, city, filters jsonb, frequency, last_sent_at, enabled
- `profiles.daily_open_house_searches` INT default 0
- `profiles.daily_open_house_searches_reset_at` TIMESTAMPTZ
- `email_preferences.open_house_digest` BOOLEAN default true

All with GRANTs + RLS scoped to `auth.uid()`. Service role full access for edge functions.

**New edge functions:**
- `open-houses-search` — Firecrawl proxy + cache + tier check
- `send-open-house-digest` — cron-triggered email batch (uses `CRON_SHARED_SECRET`)

**Shared modules (`supabase/functions/_shared/openHouses/`):**
- `tool.ts` — Zod schema + tool definition reused by every chat function
- `searchClient.ts` — calls `open-houses-search` internally
- `limiter.ts` — checks/increments daily counter
- `formatCards.ts` — converts results to PropertyCard UIBlocks

**Cron jobs (via `src/lib/openHouseDigestCron.sql`, not migration):**
- `open-house-digest-daily` 11:00 UTC daily
- `open-house-digest-weekly` 22:00 UTC Fridays

**Frontend files:**
- `src/pages/OpenHouses.tsx`
- `src/components/openHouses/FilterBar.tsx`
- `src/components/openHouses/OpenHouseCard.tsx`
- `src/components/openHouses/OpenHouseMap.tsx`
- `src/hooks/useOpenHouseSearch.tsx` (15min localStorage cache + stale-while-revalidate)
- `src/hooks/useOpenHouseAlerts.tsx`
- Route added in `App.tsx`, nav link in `Header.tsx`
- `src/data/caProvincesCities.ts` for Canadian cities

**Chrome extension:**
- Add open-house intent detection in `chrome-extension/background.ts` routing logic
- On detection, call `extension-followups` with new `action: 'find_open_houses'`
- Render compact cards in popup using extension styles (white house outline, `#1E2D3D` accents)

## Out of scope (follow-ups)
- Virtual-only filter UI (data captured, surface later)
- Push notifications (email only for v1)
- .ics calendar export
- Agent contact form

## Open questions
None — all scoping answered.
