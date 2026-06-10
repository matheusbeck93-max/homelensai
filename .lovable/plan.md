## Problem

The Overview tab on `/console` shows **"AI Credits — Unlimited · Premium plan"** for any paid tier. That card (`src/components/console/AiCreditsCard.tsx`) is built on the legacy `useAiCredits` hook, which treats every paid tier as unlimited. It predates the new three-tier budget model (Free $3/day, Buyer $12/day, Investor $40/day + monthly caps + credit top-ups), so it contradicts the header chip and `/account/usage` page.

## Fix

Replace the legacy card with a new cap-aware Overview card that mirrors the header chip + usage page contract (no "unlimited" anywhere).

### 1. New component `src/components/console/UsageSummaryCard.tsx`
- Reads from `useBudgetCap()` (already used by header chip and cap blockers).
- Hidden when `isStaff` is true or `loaded` is false (skeleton instead).
- Shows:
  - Title: "AI Usage" with Sparkles icon.
  - Today: `$X.XX of $Y.YY used today` + progress bar.
  - Month: `$X of $Y this month` + progress bar (smaller).
  - Credits balance line when `creditsBalanceUsd > 0` ("+$X.XX in credits").
  - Reset countdown for daily cap (reuse the same `msUntilNextUtcReset` helper inline).
  - Color states: red border at `exceeded`, amber at `approaching`, default otherwise.
- Actions row:
  - "View details" → `/account/usage`.
  - "Buy credits" (paid tiers only) → opens existing `TopUpDialog` with `source="usage_page"` style telemetry (`source: "usage_page"` is fine here; or add `overview_card` to the enum — see below).
  - "Upgrade" (free/buyer only) → `/pricing`, emits `upgrade_cta_clicked` via `emitUsageEvent` with `source: "usage_page"` (or new `overview_card`).

### 2. Telemetry enum update
Add `"overview_card"` to `UsageEventSource` in `src/lib/telemetry/usageEvents.ts` and document it in `docs/telemetry/usage-events.md`. Use it for the new card's clicks (`usage_indicator_clicked`, `upgrade_cta_clicked`, `topup_pack_clicked` source override).

### 3. Wire into Overview
In `src/components/console/OverviewPanel.tsx`:
- Replace `import { AiCreditsCard }` with `import { UsageSummaryCard }`.
- Replace `<AiCreditsCard />` with `<UsageSummaryCard />`.

### 4. Cleanup
- Delete `src/components/console/AiCreditsCard.tsx` (no other importers — confirmed by audit; will re-grep before deleting).
- Leave `src/hooks/useAiCredits.tsx` and `src/lib/subscription.ts` alone — still used by other surfaces (out of scope for this UI fix).

## Out of scope
- Backend changes, edge functions, schema.
- Header chip, `/account/usage`, cap blockers (already correct).
- Refactoring `useAiCredits` or daily-limit logic.

## Files

- **Add**: `src/components/console/UsageSummaryCard.tsx`
- **Edit**: `src/components/console/OverviewPanel.tsx`, `src/lib/telemetry/usageEvents.ts`, `docs/telemetry/usage-events.md`
- **Delete**: `src/components/console/AiCreditsCard.tsx` (after confirming no remaining importers)
