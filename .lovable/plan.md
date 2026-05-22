## Problem
Saving Preferences fails with: `new row for relation "profiles" violates check constraint "profiles_buyer_type_check"`.

The DB CHECK on `profiles.buyer_type` only allows `'investor' | 'first-time-buyer' | 'regular-buyer'`. But `PreferencesPanel.tsx` sends:
- `"unspecified"` when no persona is selected, and
- new persona values (`first_time_buyer`, `move_up_buyer`, `downsizer`, `relocator`) that aren't in the constraint.

The modern source of truth is the `buyer_types` array column; `buyer_type` is the legacy single-value column.

## Fix (frontend only, no migration)
In `src/components/console/PreferencesPanel.tsx` `buildUpdatePayload()`:

- Map the selected persona to the legacy enum:
  - `investor` → `investor`
  - `first_time_buyer` → `first-time-buyer`
  - everything else (move-up, downsizer, relocator, empty) → `null`
- Set `buyer_type` to the mapped value (allow `null`, never `"unspecified"`).
- Leave `buyer_types` array untouched so the full persona list is still persisted.

Also update the load path (line 130) so `buyer_type === null` is handled (already fine with the `&&` guard, just remove the obsolete `"unspecified"` comparison).

## Verification
- Save preferences with no persona selected → succeeds (`buyer_type = null`).
- Save with "Investor" → succeeds, `buyer_type = 'investor'`.
- Save with "Move-up Buyer" → succeeds, `buyer_type = null`, `buyer_types = ['move_up_buyer']`.
