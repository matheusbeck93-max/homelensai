## Smart Preference Follow-ups in the Chrome Extension (v2)

Turn the extension's match-score view into an active preference-shaping surface. When a listing mismatches saved prefs, show up to **2** one-tap CTAs: `Update preferences` / `Save as exception` / dismiss.

### Schema reality check (done)

Inspected live `public.profiles`. The relevant structured fields already exist — direct one-tap updates write to discrete columns; `about_me` is *not* the source of truth for any of them. Mapping:

| Follow-up concept | `profiles` column          | Type          | Status |
| ----------------- | -------------------------- | ------------- | ------ |
| Locations         | `preferred_cities`         | `text[]`      | exists |
| Budget max        | `budget_max`               | `numeric`     | exists |
| Budget min        | `budget_min`               | `numeric`     | exists |
| Property types    | `property_types`           | `text[]`      | exists |
| Min beds          | `min_bedrooms`             | `integer`     | exists |
| Min baths         | `min_bathrooms`            | `integer`     | exists |
| Min sqft          | `min_sqft`                 | `integer`     | exists |
| Cap rate target   | `target_cap_rate`          | `numeric`     | **new — added in this migration** |
| Extension toggle  | `extension_smart_suggestions_enabled` | `boolean` default `true` | **new — added in this migration** |

Conclusion: structured columns are the source of truth; the direct-update endpoint writes to them with no `about_me` reconciliation needed. (`location_preferences` jsonb also exists but `preferred_cities` is the array surface used by preferences UI; we write to `preferred_cities`.)

### 1. Migration (one file)

- `ALTER TABLE public.profiles ADD COLUMN target_cap_rate numeric, ADD COLUMN extension_smart_suggestions_enabled boolean NOT NULL DEFAULT true;`
- New table `user_exception_properties` — columns: `id`, `user_id`, `property_url`, `listing_snapshot jsonb`, `reason text`, `note text`, `created_at`, `updated_at`. Unique `(user_id, property_url)`. RLS owner-only via `auth.uid()`. Grants: `SELECT/INSERT/UPDATE/DELETE` to `authenticated`, `ALL` to `service_role`. Realtime publication.
- New table `preference_followup_dismissals` — columns: `user_id`, `mismatch_type text`, `dismissed_at timestamptz default now()`. PK `(user_id, mismatch_type, dismissed_at)` + index on `(user_id, mismatch_type, dismissed_at desc)`. Same RLS + grants.
- `updated_at` trigger on `user_exception_properties` using existing `public.update_updated_at_column()`.

### 2. Backend — single edge function

`supabase/functions/extension-followups/index.ts` (no `verify_jwt` override; validates JWT in code via `_shared/profileLoader.ts` + `_shared/responses.ts`). One handler, action-routed.

**Actions:**

- `get_state` → returns `{ preferences, dismissals, settings }` in one shot.
  - `preferences`: the subset the extension needs — `preferred_cities`, `budget_min`, `budget_max`, `property_types`, `min_bedrooms`, `min_bathrooms`, `min_sqft`, `target_cap_rate`, plus `persona`/`primary_goal` for future gating.
  - `dismissals`: rows from `preference_followup_dismissals` for this user in the last 7 days.
  - `settings`: `{ extension_smart_suggestions_enabled }`.
- `update` → Zod-validated patch (`preferred_cities.add/remove`, `budget_max`, `budget_min`, `property_types.add/remove`, `min_bedrooms`, `min_bathrooms`, `min_sqft`, `target_cap_rate`, required `source`, optional `source_listing_url`, `mismatch_type`). Applies via service-role client, returns `{ success, updated_preferences }`. Inserts a `tool_call_telemetry` row tagged `extension_followup_accepted` with `{ mismatch_type, fields, source_listing_url }`.
- `dismiss` → `{ mismatch_type }`. Inserts one row into `preference_followup_dismissals` + telemetry `extension_followup_dismissed`.
- `save_exception` → `{ property_url, listing_snapshot, reason, note? }`. Upsert on `(user_id, property_url)`. Telemetry `extension_followup_saved_as_exception`.

Patch helper: array-merge (dedupe, lowercase-compare) for `preferred_cities` / `property_types`; scalar overwrite for the rest.

### 3. Extension code (`chrome-extension/`)

- `lib/detectMismatches.ts` — pure function exactly per spec. Inputs: scraped listing + the preferences object returned by `get_state`. Output: ordered `MismatchFollowup[]` (blocker → major → minor). Covers: location, budget over, budget under (informational, `update_payload: null`), property type, min beds, min baths, min sqft, target cap rate. Helpers: `normalizeMarket`, `suggestBudgetBump` (round up to nearest $25k), `prettyType`, `severityOrder`, `shouldShow` (3-in-7d gate).
- `lib/preferenceUpdate.ts` — fetch wrappers for the four `extension-followups` actions. Reads auth header from existing session token logic (same as `saveActions.ts`).
- `components/PreferenceFollowupCard.tsx` — single card: icon + question + 3 buttons. Variants:
  - **Actionable** (`update_payload` set): `[Update preferences] [Save as exception] [✗]`. On Save-as-exception click, expand inline with a small text input *"Why is this one interesting? (optional)"* + `[Save]` / `[Cancel]`. Submitting writes the note into `user_exception_properties.note`.
  - **Informational** (`update_payload: null`, e.g. under-budget): `[Tell me more] [Not really]`. "Tell me more" sends a prefilled question into the existing chat composer.
  - Inline loading + success states; on success, card collapses to a one-line confirmation toast (*"Added Fort Washington, MD to your preferences"*).
- `popup.tsx` — after rendering the match-score block:
  1. On popup open, call `get_state` once (cache in `chrome.storage.session` keyed by user id, 60s TTL).
  2. If `extension_smart_suggestions_enabled === false` or user signed out → render a single subtle pill (*"Sign in to update preferences"* when signed out; nothing when toggle off).
  3. Else run `detectMismatches(listing, preferences)`, filter via `shouldShow(_, dismissals)`, take **top 2**, render under a "Smart suggestions" header.
  4. Fire `extension_followup_shown` telemetry once per render batch (debounced per listing URL).

### 4. Main app changes

- **Settings** (`src/pages/Settings.tsx`): new toggle row "Show smart suggestions in Chrome extension" (default on), writes to `profiles.extension_smart_suggestions_enabled`.
- **Saved properties** (`src/components/console/SavedPropertiesPanel.tsx`): add an **Exceptions** subsection at the bottom: heading *"Outside your usual preferences"* + count. New hook `useExceptionProperties` mirroring `useSavedProperties`. Each row shows the reason (e.g. *"Outside your target locations: Fort Washington, MD"*) and the optional note as a muted second line. Actions: open listing, remove.
- Preferences propagate to the rest of the app via the existing `profiles` realtime subscription (already in place); no other UI changes.

### 5. Telemetry

Five events. Client-side via `src/lib/telemetry/usageEvents.ts` (extend `UsageEventPayloads`); server-side via existing `tool_call_telemetry` table (no new telemetry tables).

- `extension_followup_shown` `{ type, severity, score }`
- `extension_followup_accepted` `{ type, fields }`
- `extension_followup_saved_as_exception` `{ type, has_note }`
- `extension_followup_dismissed` `{ type }`
- `preference_updated_from_extension` `{ fields, source_listing_url }` (server-side only, fired inside the `update` action)

### 6. Anti-nagging

Client-side filter using `dismissals` from `get_state`. Rule: ≥3 dismissals of the same `mismatch_type` within the last 7 days → suppress that type for 30 days (computed from the 3rd-most-recent dismissal). User can re-enable by flipping the Settings toggle off then on, or by accepting an unrelated suggestion (does not unblock). Stored decisions live only in the DB — no extension-local persistence to drift.

### 7. Verification checklist

- Fort Washington listing + Prince William prefs → top card is "Add Fort Washington, MD"; click → row in `profiles.preferred_cities` updates within 2s in main app via realtime.
- $700k listing, budget $500k → budget bump CTA appears, suggested value rounds to $725k.
- $300k listing, budget $700k → informational "under your budget" card with `[Tell me more] [Not really]`.
- Save as exception → text input appears; submit with a note → row in `user_exception_properties` with `note` populated; visible in main app's Exceptions section.
- 3 dismissals of `location` in a week → 4th visit suppresses the location card for 30 days.
- Settings toggle off → no cards render in popup.
- Signed out → single pill, no cards, no `get_state` request.
- Telemetry: 5 events fire at the expected moments.

### 8. Commit / PR order

1. Migration: new columns on `profiles`, `user_exception_properties`, `preference_followup_dismissals`, RLS + grants, realtime.
2. Edge function `extension-followups` (all 4 actions, with `get_state` returning preferences + dismissals + settings in one call).
3. Extension: `lib/detectMismatches.ts` + helpers.
4. Extension: `lib/preferenceUpdate.ts` + `components/PreferenceFollowupCard.tsx` (with note-on-exception inline input).
5. Extension: wire into `popup.tsx` with cached `get_state`, anti-nagging gate, signed-out + toggle-off fallbacks, top-2 cap.
6. Main app: Settings toggle + Exceptions subsection in `SavedPropertiesPanel`.
7. Telemetry events both sides.

### 9. Out of scope (per spec)

AI-generated mismatch copy, bulk-accept, copy A/B tests, AI-prefilled exception notes, persona-aware follow-up gating (ship v1 persona-agnostic; the `persona`/`primary_goal` fields are returned by `get_state` for a later pass).
