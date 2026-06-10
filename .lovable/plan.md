# HomeLens — Tier Caps + Usage Transparency

## Current state (verified)

- `Tier` type is already `"free" | "buyer" | "investor"` — no `unlimited` to remove from code.
- DB `profiles.subscription_status` is a text column with values `free` / `investor` only (no `unlimited` rows, no enum to alter, no `is_staff` column yet).
- `budgetGuard.ts` already enforces daily caps at $0.10 / $0.50 / $1.50 with env overrides. No monthly cap, no staff bypass.
- Top-up credits infra exists: `user_credits`, `buy-credits`, `_shared/credits.ts`, `BudgetCapBlocker` + `TopUpPacks`, `budget-status` exposes packs.

So Part 1 collapses to: **add `is_staff`, sanity-check legacy `unlimited`/`premium` mappings, and confirm no dead `unlimited` references**. The real work is monthly cap + Usage page + header indicator + polish.

## Plan

### 1. DB migration — staff flag + usage rollup view

- Add `profiles.is_staff boolean not null default false` (RLS: only service_role writes; readable by owner via existing profile policies).
- Defensive backfill: `update profiles set subscription_status = 'free' where subscription_status not in ('free','buyer','investor');`
- Add `check (subscription_status in ('free','buyer','investor'))` constraint.
- Create materialized view `v_user_usage_daily` aggregating `ai_usage_log` over the last 60 days by (user_id, day, surface) with unique index. Grant `SELECT` to `authenticated` + `service_role`; RLS via wrapper view or have endpoint filter by `auth.uid()` in service-role query.
- Cron job (pg_cron via `supabase--insert`): `refresh materialized view concurrently v_user_usage_daily` hourly.

### 2. Budget guard — monthly cap + staff bypass + cap_type

Update `supabase/functions/_shared/ai/budgetGuard.ts`:

- Add `MONTHLY_BUDGET_USD = { free: 3, buyer: 12, investor: 40 }` with env overrides (`AI_BUDGET_MONTHLY_*_USD`).
- New `getMonthSpendUsd(userId)` summing `ai_usage_log` for current UTC month.
- `checkBudget` order: staff bypass → daily check → monthly check; on exceed, attempt credit consumption (oldest-first) before throwing.
- `BudgetExceededError` gains `capType: "daily" | "monthly"` and `monthlyUsedUsd` / `monthlyCapUsd` / month `resetAt` (first of next month UTC).
- `buildBudgetExceededPayload` includes `cap_type`, `usage_month_usd`, `monthly_limit_usd`, monthly `reset_at` when applicable.
- Add `isStaffUser(userId)` helper that reads `profiles.is_staff` (cached per request).
- Confirm credit consumption order is oldest-`expires_at`-first in `_shared/credits.ts`; fix if not.

### 3. `budget-status` + new `usage-summary` endpoints

- Extend `budget-status` response with `cap_type`, monthly figures, and `is_staff`.
- New edge function `supabase/functions/usage-summary/index.ts` returning the full JSON shape from the spec:
  - Reads today live from `ai_usage_log`; reads 30-day trend + per-surface from `v_user_usage_daily`.
  - Computes `projected_end_of_month_usd` = `(month_used / days_elapsed) * days_in_month`, plus `projected_cap_hit_date` when projection exceeds monthly cap.
  - Credits: balance, next expiry, `expires_soon` (< 7 days), recent purchases from `topup_events`.
  - `next_tier` block hardcoded from pricing constants; `null` for Investor.
  - Staff payload: caps `null`, `is_staff: true`.

### 4. Frontend — Usage page `/account/usage`

Wire route in `src/App.tsx`. New components:

- `src/pages/account/Usage.tsx` — page shell, polls `usage-summary` every 60s.
- `src/components/usage/UsageHero.tsx` — today donut/bar + remaining turns (turns = `remaining_usd / 0.020`) + Buy credits / Upgrade CTAs.
- `src/components/usage/UsageMonthChart.tsx` — 30-day bar chart with daily-cap dotted line (recharts, already in deps).
- `src/components/usage/PerSurfaceBreakdown.tsx` — horizontal bars.
- `src/components/usage/CreditsBalance.tsx` — balance + expiry + buy-pack popover (reuses `TopUpPacks`).
- `src/components/usage/TopUpHistory.tsx` — collapsible.
- `src/components/usage/PlanComparison.tsx` — hidden for Investor; reads from `next_tier`.
- Staff users see "Internal account — no caps" panel instead of hero/projection.
- 7-day credit-expiry warning banner at top.

### 5. Header usage indicator

- `src/components/layout/HeaderUsageIndicator.tsx` — small `⚡ NN%` chip next to avatar in `Navigation.tsx`. Reads from existing `useBudgetCap` hook (extended to expose `usage_pct`).
- Color thresholds: gray <50, blue 50–75, amber 75–100, red ≥100.
- Click opens Popover with today + month numbers + "View full usage" link.
- Hidden when `is_staff`. On mobile, lives inside hamburger drawer.

### 6. Cap blocker copy + UpgradeCTA polish

- `src/components/ai/BudgetCapBlocker.tsx` branches on `cap.capType`:
  - Daily: "Resets at midnight."
  - Monthly: `"Resets ${first-of-next-month formatted}."`
- Free users: no top-up packs (already correct), upgrade-to-Buyer CTA.
- Investor users: no upgrade CTA (already correct), packs shown.

### 7. Settings/Account integration + telemetry

- Add Subscription & Usage section link to `/account/usage` from Console/Settings.
- Telemetry events (window CustomEvents, consumed by existing logger):
  `usage_page_viewed`, `usage_indicator_clicked`, `usage_projection_shown`, `topup_clicked_from_usage`, `credit_expiry_warning_shown`.

### 8. Verification

- Manual: simulate Free hit (insert `ai_usage_log` rows via `supabase--insert`) → blocker shows upgrade-only.
- Buyer daily and monthly cap hits → distinct copy.
- Investor daily cap hit → no upgrade row.
- Staff user → no blocker, no header chip, Usage page shows internal copy.
- Stripe Live price IDs present (`STRIPE_CREDIT_PACK_*_PRICE_ID` secrets already set — confirm with user they're Live mode).
- `grep -r unlimited` returns no tier-related hits.

## Out of scope

Email digests, ML forecasting, custom % alerts, CSV export, team pooling, help-center pages.

## Open question

The spec requires Stripe credit-pack Products to exist in **Live** mode. Secrets exist but I can't verify Live-vs-Test from here — I'll flag this for manual confirmation after shipping, not block the PR.
