# Standardize Usage Telemetry

Goal: one canonical contract for all usage / cap / top-up / upgrade events, emitted from one helper, documented in one file. No new analytics backend — we keep dispatching `CustomEvent`s on `window` (current pattern) but normalize names and payloads.

## Current state (audit)

Events fired today, with inconsistent payloads:

| Event | Source file | Payload keys |
|---|---|---|
| `homelens:usage_page_viewed` | `pages/account/Usage.tsx` | (none) |
| `homelens:usage_indicator_clicked` | `layout/HeaderUsageIndicator.tsx` | `tier, source, driver, pct` |
| `homelens:upgrade_cta_clicked` | `ai/UpgradeCTA.tsx` | `fromTier, source, capSessionId` |
| `homelens:upgrade_cta_clicked` | `account/usage/NextTierCompare.tsx` | `source, to_tier` |
| `homelens:topup_pack_clicked` | `ai/TopUpPacks.tsx` | `pack_size, surface` |
| `homelens:topup_offered` | `ai/BudgetCapBlocker.tsx` | `tier, surface, cap_type` |
| `homelens:budget_cap_hit_shown` | `ai/BudgetCapBlocker.tsx` | `tier, surface, cap_type, source, usage_today_usd` |
| `homelens:budget_cap_approaching_shown` | `ai/BudgetCapBanner.tsx` | `tier, surface, usage_pct` |

Problems: mixed camelCase / snake_case (`fromTier` vs `to_tier`, `pack_size` vs `capSessionId`), missing `tier` on some events, missing `cap_type` on banner/upgrade, `source` values not enumerated, two emitters of `upgrade_cta_clicked` with disjoint shapes.

## Canonical contract

All event names stay under the `homelens:` namespace. All payload keys use `snake_case`.

Shared fields (included on every event when known):
- `tier`: `"free" | "buyer" | "investor"`
- `source`: enum — `"header_chip" | "usage_page" | "cap_blocker_daily" | "cap_blocker_monthly" | "cap_banner" | "topup_packs" | "next_tier_compare" | "chat_inline"`
- `surface`: existing surface id (`general_chat`, `investor_chat`, `extension`, …) when applicable
- `cap_type`: `"daily" | "monthly"` when the event is cap-related

Events:

| Name | Required | Optional |
|---|---|---|
| `homelens:usage_page_viewed` | `tier` | `pct_day, pct_month, credits_balance` |
| `homelens:usage_indicator_clicked` | `tier, source, pct, driver` | `cap_type` |
| `homelens:budget_cap_approaching_shown` | `tier, surface, source, cap_type, usage_pct` | — |
| `homelens:budget_cap_hit_shown` | `tier, surface, source, cap_type, usage_today_usd` | `cap_session_id` |
| `homelens:topup_offered` | `tier, surface, source, cap_type` | — |
| `homelens:topup_pack_clicked` | `tier, source, pack_size` | `surface, cap_type` |
| `homelens:upgrade_cta_clicked` | `tier, source, to_tier` | `cap_session_id, cap_type` |

Notes:
- `tier` is the user's current tier; `to_tier` is the upgrade target.
- `cap_session_id` (renamed from `capSessionId`) only travels with cap-driven CTAs.
- `pack_size` stays numeric (USD).

## Implementation

1. **New helper** `src/lib/telemetry/usageEvents.ts`
   - Exports TypeScript types `UsageEventName`, `UsageEventPayloads`, `UsageEventSource`, `CapType`, `Tier`.
   - Exports `emitUsageEvent(name, payload)` that wraps `window.dispatchEvent(new CustomEvent(name, { detail }))` inside try/catch and drops empty values.
   - Single source of truth — no other file constructs `CustomEvent` for these names.

2. **Refactor call sites** to use `emitUsageEvent`:
   - `src/pages/account/Usage.tsx` — include `tier` + percentages from the fetched summary.
   - `src/components/layout/HeaderUsageIndicator.tsx` — already close; rename to snake_case via helper.
   - `src/components/ai/UpgradeCTA.tsx` — rename `fromTier`→`tier`, `capSessionId`→`cap_session_id`; require `source`.
   - `src/components/account/usage/NextTierCompare.tsx` — add `tier`, normalize.
   - `src/components/ai/TopUpPacks.tsx` — add `tier` + `source` (passed from parent: `cap_blocker_*`, `usage_page`, `header_chip`).
   - `src/components/ai/BudgetCapBanner.tsx` — add `source: "cap_banner"`, `cap_type`.
   - `src/components/ai/BudgetCapBlocker.tsx` — keep semantics, route through helper.

3. **Pass-through props**: `TopUpPacks` and `UpgradeCTA` accept a `source` prop (already partly present). Default values removed so TS forces every call site to declare its source.

4. **Docs**: add `docs/telemetry/usage-events.md` with the table above, the enum values, and a short "how to add a new event" note. Link from `.lovable/plan.md`.

5. **Smoke check**: add a tiny unit test `src/lib/telemetry/__tests__/usageEvents.test.ts` (vitest) asserting that `emitUsageEvent` dispatches the right name and strips undefined fields.

## Out of scope

- No new server-side analytics tables. The existing `upgrade_cta_events` insert in `UpgradeCTA.tsx` stays as-is.
- No change to edge functions or DB schema.
- No new UI.

## Files

- add: `src/lib/telemetry/usageEvents.ts`
- add: `src/lib/telemetry/__tests__/usageEvents.test.ts`
- add: `docs/telemetry/usage-events.md`
- edit: `src/pages/account/Usage.tsx`
- edit: `src/components/layout/HeaderUsageIndicator.tsx`
- edit: `src/components/ai/UpgradeCTA.tsx`
- edit: `src/components/ai/TopUpPacks.tsx`
- edit: `src/components/ai/BudgetCapBanner.tsx`
- edit: `src/components/ai/BudgetCapBlocker.tsx`
- edit: `src/components/account/usage/NextTierCompare.tsx`
- edit: `.lovable/plan.md` (link to docs)
