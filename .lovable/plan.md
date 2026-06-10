## Polish pass: tier-cap + usage transparency follow-ups

Five focused cleanups on top of what already shipped. Each is independent and small.

### 1. Monthly-cap tests in `budgetGuard_test.ts`
Mirror the existing daily-cap tests for the new monthly path:
- `checkBudget` returns `exceeded` with `capType: "monthly"` when monthly spend ≥ tier limit even if daily is under.
- `BudgetExceededError` payload includes `reset_at = first of next month UTC` and the correct `cap_type`.
- Staff bypass (`is_staff: true`) skips both daily and monthly checks.
- Buyer ($12) and Investor ($40) limits assert the correct thresholds.

### 2. Throttle the credit-expiry warning to once per day
On `/account/usage`, the `expires_soon` banner currently shows on every visit. Add a `localStorage` key `homelens:credit_expiry_dismissed:<yyyy-mm-dd>` and:
- Suppress the banner if today's key exists.
- Provide a "Dismiss" button that writes the key.
- Auto-show again the next calendar day.

### 3. Split `src/pages/account/Usage.tsx` into components
Current file is one 222-line page. Extract under `src/components/account/usage/`:
- `UsageHero.tsx` — tier name, today's spend, remaining-turns estimate, reset time.
- `UsageTrendChart.tsx` — 30-day Recharts line chart from `month_trend` (verify Recharts is actually used; add it if the current render is a placeholder).
- `SurfaceBreakdown.tsx` — per-surface 30-day cost table.
- `CreditsCard.tsx` — balance, expiry banner (with throttle from #2), recent purchases, `TopUpPacks`.
- `NextTierCompare.tsx` — upgrade CTA + tier comparison block (hidden for Investor).
`Usage.tsx` becomes a thin orchestrator that fetches `usage-summary` once and passes data down.

### 4. Telemetry on new upgrade/top-up surfaces
Insert into existing `upgrade_cta_events` and `topup_events` tables with a `source` field:
- `HeaderUsageIndicator` popover "View usage details" click → `source: "header_chip"`.
- Usage page Upgrade button → `source: "usage_page"`.
- Usage page top-up pack purchase → `source: "usage_page"` on the existing top-up insert path.
- BudgetCapBlocker already logs; add `source: "cap_blocker_monthly"` vs `"cap_blocker_daily"` differentiation.

### 5. Inline top-up shortcut in header popover (paid tiers only)
In `HeaderUsageIndicator`, when `tier !== "free"` and usage ≥ 50% on either axis, add a secondary "Buy credits" button under "View usage details" that opens the existing `TopUpDialog`. Free users keep the single CTA (which on the Usage page becomes Upgrade).

---

### Out of scope
- Reworking edge-function logic (already in place).
- Database/migration changes (schema is final).
- Mobile-specific layouts beyond what the existing components already handle.

### Validation
- Run `supabase--test_edge_functions` against `_shared/ai` after #1.
- Manual: visit `/account/usage` on a paid test account, confirm chart renders, dismiss expiry warning, refresh, confirm it stays dismissed today and reappears tomorrow.
- Confirm header chip shows "Buy credits" once usage crosses 50% on a Buyer account.

### Files touched
- `supabase/functions/_shared/ai/__tests__/budgetGuard_test.ts` (edit)
- `src/pages/account/Usage.tsx` (slim down)
- `src/components/account/usage/{UsageHero,UsageTrendChart,SurfaceBreakdown,CreditsCard,NextTierCompare}.tsx` (new)
- `src/components/layout/HeaderUsageIndicator.tsx` (edit)
- `src/lib/telemetry/upgradeCta.ts` (new small helper) and call sites
