# Billing Structure Implementation Plan

## Rules (confirmed)
- **Trial**: 7 days, **once per user** (first-time subscribers only).
- **Billing cycle**: anchored to subscription start date (B2C); auto-charge after trial; monthly renewal on same date.
- **Plan credits**: monthly allowance per tier, **reset every cycle** (no rollover).
- **Top-up credits**: one-time purchase, **expire 90 days** after purchase.
- **Consumption order**: plan credits first → top-ups (FIFO by purchase date) last.

---

## 1. Database changes

### `subscription_plans` (new lookup table)
Columns: `tier` (PK: `buyer` | `investor`), `stripe_price_id_monthly`, `stripe_price_id_annual`, `monthly_credit_allowance_usd`, `trial_days` (default 7).
Seed: Buyer + Investor rows. Allowance values left as `NULL` initially (user will define).

### `profiles` additions
- `trial_used_at TIMESTAMPTZ` — set the first time a user starts any trial; checked to block re-trialing.
- `current_period_start TIMESTAMPTZ`, `current_period_end TIMESTAMPTZ` — mirrored from Stripe subscription.
- `plan_credits_remaining_usd NUMERIC(10,4)` — current-cycle plan allowance balance.
- `plan_credits_allowance_usd NUMERIC(10,4)` — snapshot of the allowance for this cycle (for UI "X of Y used").

### `user_credits` (existing top-up table) — confirm:
- `expires_at` already exists → change default insert to `purchased_at + 90 days` (currently 30 in `_shared/credits.ts`).
- Add column `source TEXT` (default `'topup'`) — future-proof if we ever store plan grants here.

### `topup_events` — add event types `plan_granted`, `plan_reset` for telemetry.

---

## 2. Stripe configuration
- All paid Price IDs must have `trial_period_days = 7` configured on the Stripe Price (or passed per checkout session — we'll do it in `create-checkout`).
- Confirm/create the 4 current Price IDs (buyer monthly/annual, investor monthly/annual) — already env-pinned in `_shared/subscriptions.ts`.

---

## 3. Edge function changes

### `create-checkout`
- Look up `profiles.trial_used_at`. If `NULL`, pass `subscription_data.trial_period_days = 7` to Stripe Checkout. Otherwise omit (no second trial).
- On successful session creation (or via webhook), set `trial_used_at = now()` to lock out future trials.

### `stripe-webhook`
Handle these events and update `profiles`:
- `customer.subscription.created` → set tier, `current_period_start/end`, grant initial plan credits (`plan_credits_remaining_usd = allowance`, `plan_credits_allowance_usd = allowance`). Set `trial_used_at` if not set.
- `customer.subscription.updated` → on period rollover (detect `current_period_start` change), **reset** plan credits to allowance (no rollover). Emit `plan_reset` topup_event.
- `invoice.payment_succeeded` → confirm renewal, same reset logic as a safety net.
- `customer.subscription.deleted` / `canceled` → downgrade to `free`, zero plan credits.
- `checkout.session.completed` for top-up packs → already handled; just change credit expiry to 90 days.

### `_shared/credits.ts` — consumption logic
New helper `consumeAnyCredits(userId, amountUsd)`:
1. Debit `profiles.plan_credits_remaining_usd` first (clamp at 0).
2. If remainder > 0, call existing `consumeCredits()` (top-up FIFO).
3. Return combined remaining balance.
Replace all current callers of `consumeCredits` in the AI budget guard with `consumeAnyCredits`.

### `budget-status`
Return both buckets: `{ planCreditsRemainingUsd, planCreditsAllowanceUsd, topupBalanceUsd, nextExpiresAt, periodEnd }`.

### Cron / sweep
- Existing `expireOldCredits` continues to flip expired top-ups → just driven by the new 90-day `expires_at`.
- Add a daily cron job to detect missed renewals (in case webhook is delayed): if `current_period_end < now()`, call `check-subscription` to reconcile.

---

## 4. Frontend changes
- `useAiCredits` / `BudgetCapBanner` → show plan vs top-up split: "X / Y plan credits • $Z top-up".
- Pricing page → show "7-day free trial" badge only when `trial_used_at` is null; show "Trial already used" note otherwise.
- Top-up purchase dialog → update copy: "Credits expire 90 days after purchase".
- Console / Account tab → show current period dates and next renewal.

---

## 5. Open items needing your input before build
The plan can land without these, but allowances are placeholders until you give numbers:
- **Buyer monthly credit allowance ($)?**
- **Investor monthly credit allowance ($)?**
- Stripe Price IDs for Investor monthly/annual — are they already created in Stripe? (Buyer ones exist.)

---

## Technical notes
- Reset detection uses Stripe's `current_period_start` change rather than a wall-clock cron to avoid double-grants on retries.
- Plan credit reset is non-destructive to top-ups (separate columns / tables).
- All `profiles` numeric updates are idempotent: webhook handler uses Stripe `event.id` dedup table (already present in `stripe-webhook`).
- RLS: plan-credit columns on `profiles` are already covered by existing self-select policy; service-role writes from webhook bypass RLS.
