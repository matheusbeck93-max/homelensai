## 1. Add BRRRR tab to the Investor Calculator page

**File:** `src/pages/InvestorCalculator.tsx`

Wrap the current calculator in a `Tabs` component with two tabs:
- **Rental (Cash Flow / IRR)** — the existing `HomeLensInvestorCalculator`.
- **BRRRR** — renders the shared `BrrrrCalculatorPanel` (already exported from `src/pages/CalculatorBrrrr.tsx` and reused on `/calculators?tab=brrrr`).

Tab state syncs to a `?tab=rental|brrrr` search param (mirrors the pattern used on `/calculators`). Page title/description updated to mention BRRRR. Both tabs remain inside the existing `TierGate` (Investor plan).

## 2. "Set as my budget" action on the Buying Power calculator

**File:** `src/pages/Calculators.tsx` (Buying Power tab only)

In the Buying Power results card, add a new action row below the "Estimated Buying Power" tile:

- **Button:** "Set as my budget preference"
- Disabled when `estimatedBuyingPower <= 0`.
- On click:
  1. Load current preferences from `profiles.preferences` for the signed-in user.
  2. Merge `budget.purchase_price_max = Math.round(estimatedBuyingPower)` (and `budget.down_payment = downPaymentAvailable` when > 0) into the existing object.
  3. Persist by calling the existing edge function:
     `supabase.functions.invoke("preferences-assistant", { body: { action: "edit", preferences: merged } })`
     — same path `PreferencesChat` uses, so validation/summary stay consistent.
  4. Toast success ("Budget updated in your preferences") or error.
- Small helper text under the button: "Updates the max purchase price used across HomeLens."
- A subtle "View preferences" link → `/console?tab=preferences`.

Nothing else changes: no schema, no RLS, no new edge function, no changes to Mortgage/BRRRR calculators or backend.

## Technical notes

- Reuse `BrrrrCalculatorPanel` — no duplication.
- Preference write goes through `preferences-assistant` (already handles auth, merging, and updated_at), so the trigger `prevent_privileged_profile_updates` is not touched.
- Loading state on the button while the invoke is in flight; guard against unauthenticated users with a redirect toast.
