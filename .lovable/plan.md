## Problem

On `/calculators?tab=buying-power`, "Estimated Buying Power" only reacts to **Down Payment Available** — it ignores Annual Income and Monthly Debts. Current formula:

```ts
estimatedBuyingPower = downPaymentAvailable / 0.20
```

Mortgage tab (PITI + PMI + HOA) and BRRRR tab (`BrrrrCalculatorPanel`) are correct — no changes.

## Fix (frontend only, `src/pages/Calculators.tsx`)

### 1. New income + DTI-based math

Extract a pure helper `computeBuyingPower({ annualIncome, monthlyDebts, downPaymentAvailable, assumptions })` returning `{ actualDTI, maxAffordablePayment, maxHousingPayment, estimatedBuyingPower }`.

- `maxHousingPayment = max(0, monthlyIncome * (dtiPct/100) - monthlyDebts)` — default DTI 43%.
- `maxAffordablePayment = monthlyIncome * 0.28` (kept for the "Max Affordable Payment" tile).
- Back-solve max home price via binary search (same pattern as `supabase/functions/_shared/ai/tools/followups/testBuyingAbility.ts`) using the assumptions below; PITI + PMI ≤ `maxHousingPayment`.
- Cap: if `downPaymentAvailable <= 0` → `0`; else `min(dtiSolvedPrice, downPaymentAvailable / (minDownPct/100))` (default 3.5% FHA floor).

### 2. Advanced assumptions panel

Add a collapsible "Advanced assumptions" section (shadcn `Collapsible`, closed by default) inside the Buying Power input card. State + defaults:

| Field | Default |
|---|---|
| Interest rate (%) | 7.0 |
| Loan term (years) | 30 |
| Property tax rate (%/yr) | 1.2 |
| Insurance rate (%/yr of price) | 0.35 |
| PMI rate (%/yr of loan, when down <20%) | 0.5 |
| Back-end DTI cap (%) | 43 |
| Min down payment (%) — FHA floor cap | 3.5 |
| Monthly HOA ($) | 0 |

All values flow into `computeBuyingPower`. A small "Reset assumptions" ghost button restores defaults. Extend `handleResetBuyingPower` to also reset assumptions.

### 3. Insights payload

Pass `maxHousingPayment` and the current `assumptions` object to `calculator-insights` so the AI reflects the DTI-based cap and any user overrides.

## Verification

- $0 income + $50k down → Estimated Buying Power = $0 (was ~$250k).
- $150k income, $500 debts, $50k down → non-zero price; rises with income, falls with debts.
- Raising interest rate in Advanced lowers the number; raising DTI cap raises it.
- Mortgage and BRRRR tabs unchanged.
- No backend, schema, RLS, or auth changes.

## Files

- `src/pages/Calculators.tsx` — new `computeBuyingPower` helper, advanced-assumptions Collapsible + state, updated insights payload.
