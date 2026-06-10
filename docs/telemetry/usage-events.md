# Usage Telemetry Events

All usage / cap / top-up / upgrade telemetry is dispatched as `window`
`CustomEvent`s under the `homelens:` namespace, with `snake_case` payload
keys. The canonical contract lives in
[`src/lib/telemetry/usageEvents.ts`](../../src/lib/telemetry/usageEvents.ts).

**Always emit through the helper.** Do not build the `CustomEvent` by hand:

```ts
import { emitUsageEvent } from "@/lib/telemetry/usageEvents";

emitUsageEvent("homelens:upgrade_cta_clicked", {
  tier: "free",
  source: "cap_blocker_daily",
  to_tier: "buyer",
  cap_session_id: "uuid-...",
});
```

## Shared fields

| Field      | Type                                                                                                                                                       | Notes                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `tier`     | `"free" \| "buyer" \| "investor"`                                                                                                                          | User's current tier.                 |
| `source`   | `"header_chip" \| "usage_page" \| "cap_blocker_daily" \| "cap_blocker_monthly" \| "cap_banner" \| "topup_packs" \| "next_tier_compare" \| "console_plan" \| "chat_inline"` | Where the event originated.          |
| `surface`  | string                                                                                                                                                     | Real AI surface id, e.g. `general_chat`, `investor_chat`, `extension`. |
| `cap_type` | `"daily" \| "monthly"`                                                                                                                                     | Which cap fired (cap-related events).|
| `to_tier`  | `Tier`                                                                                                                                                     | Upgrade target on CTA clicks.        |

## Events

| Name | Required | Optional |
| --- | --- | --- |
| `homelens:usage_page_viewed` | `tier` | `pct_day`, `pct_month`, `credits_balance` |
| `homelens:usage_indicator_clicked` | `tier`, `source` (`header_chip`), `pct`, `driver` | `cap_type` |
| `homelens:budget_cap_approaching_shown` | `tier`, `surface`, `source`, `cap_type`, `usage_pct` | — |
| `homelens:budget_cap_hit_shown` | `tier`, `surface`, `source`, `cap_type`, `usage_today_usd` | `cap_session_id` |
| `homelens:topup_offered` | `tier`, `surface`, `source`, `cap_type` | — |
| `homelens:topup_pack_clicked` | `tier`, `source`, `pack_size` | `surface`, `cap_type` |
| `homelens:upgrade_cta_clicked` | `tier`, `source`, `to_tier` | `cap_session_id`, `cap_type`, `surface` |

## Adding a new event

1. Add the event name + payload shape to `UsageEventPayloads` in
   `src/lib/telemetry/usageEvents.ts`.
2. Update the table above.
3. Emit via `emitUsageEvent(...)` — TypeScript will enforce the payload.

## Out of scope

- Server-side analytics tables (e.g. `upgrade_cta_events`) keep their own
  contract; the helper does not insert rows for you.
- Non-usage events (chat history, properties, etc.) are not covered here.