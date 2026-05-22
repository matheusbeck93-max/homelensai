## Issues found in Console → Preferences

### 1. Production save still fails
The `buyer_type` CHECK constraint fix is in code but the **production build hasn't been republished**. The fix maps new persona values (`first_time_buyer` → `first-time-buyer`, `investor` → `investor`, others → `null`) so it satisfies the legacy constraint. Republishing should resolve the production error.

If after republishing the error persists, the likely secondary culprit is the `buyer_types` array column rejecting new persona values via a separate CHECK — I'll verify and, if needed, drop/relax that array constraint in a migration.

### 2. Missing fields: Min Bedrooms and Sqft range
The form currently only shows **Min Bathrooms**. We'll add:
- **Min Bedrooms** input → maps to existing `profiles.min_bedrooms` column.
- **Min Sqft** and **Max Sqft** inputs → requires a small migration to add `min_sqft` and `max_sqft` (integer, nullable) to `profiles`.

### 3. Cities don't autocomplete
The "Preferred Cities" rows are plain text inputs. We'll replace each row with a **Combobox (Command + Popover)** powered by `src/data/usStatesCities.ts`:
- Typing filters the curated US city list (city + state shown together).
- Selecting an option fills both `city` and `state` for that row.
- Free-text fallback preserved for cities not in the curated list (so users in smaller markets aren't blocked).

## Files to change
- `src/components/console/PreferencesPanel.tsx` — add Min Bedrooms field, Min/Max Sqft fields, swap city inputs for a city/state Combobox, load + save the new fields.
- New migration — `ALTER TABLE profiles ADD COLUMN min_sqft int, ADD COLUMN max_sqft int;` (nullable, no default).
- Verify `buyer_types` array has no CHECK constraint blocking new values; relax if needed.

## Verification
- Save with persona "Move-up Buyer" + cities + bedrooms/baths/sqft → succeeds in production.
- Typing "Aus" in a city row shows "Austin, TX" suggestion; selecting it fills both fields.
- Reloading the page restores all saved values including bedrooms and sqft range.
