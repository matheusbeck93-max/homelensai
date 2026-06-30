# AI Cost Optimization — Remaining Work

We shipped the foundation yesterday (central router, $1/$10/$25 caps, `usage-gate`, Anthropic prompt caching, Haiku routing for light tasks, `PRELAUNCH_PAUSE_BACKGROUND_JOBS`, `/admin/ai-spend` dashboard, and the start of PR #6 — `FeatureQuotaExceededError` exported from the router and 402 responses wired into `ai-chat`).

Here is what is still open.

## PR #6 — Finish quota lockdown on backend (in progress)
- `investor-chat/index.ts`: catch `FeatureQuotaExceededError` / `BudgetExceededError` and return HTTP 402 with `{ code: "QUOTA_EXCEEDED" | "BUDGET_EXCEEDED", surface, resetAt }` (same shape as `ai-chat`).
- `investor-brief/index.ts`: same 402 interception.
- `owned-property-chat/index.ts`: migrate from `rawGateway` to `completeWithFallback` so it actually flows through the budget + feature-quota guards, then add the same 402 handler.
- Audit remaining functions that still call `callAiGateway` or `rawGateway` directly (e.g. `compare-properties-ai`, `property-assistant`, `preferences-assistant`, `neighborhood-personality`, `calculator-insights`) and either route them through `completeWithFallback` or document why they stay raw.

## PR #7 — Frontend upsell wiring
- `src/lib/edgeErrors.ts` + `src/lib/ai/budgetCap.ts`: parse both `BUDGET_EXCEEDED` (daily/monthly spend) and `QUOTA_EXCEEDED` (feature monthly limit) from 402 JSON payloads; expose `{ code, surface, resetAt }` to callers.
- `Chats.tsx`, `PreferencesChat.tsx`, `InvestorBrief.tsx`, `OwnedPropertyDetail.tsx` chat panels: on 402, open `CreditsExhaustedDialog` (quota) or `<BudgetCapBlocker surface={...} />` (budget) instead of showing a generic error toast.
- SSE streams: detect a 402 frame mid-stream and surface the same blocker (today the stream just ends silently for some surfaces).
- Wire `<BudgetCapBlocker surface="preferences_assistant" />` into `PreferencesChat.tsx` explicitly.

## PR #8 — 48h verification + guardrails
Three checks the user asked for after the macro layer landed, plus the cost ones:
- Telemetry dashboard at `/admin/ai-spend`: confirm prompt-cache hit-rate column shows ≥ the target on Anthropic surfaces after 48h of real traffic.
- Confirm Haiku routing actually fires on the surfaces it was mapped to (per-surface model breakdown).
- Confirm daily/monthly budget caps trip in production for a synthetic over-cap user and produce the 402 → upsell flow end-to-end.
- Add a low-noise alert when any single user crosses 80% of monthly cap, and when daily project-wide spend crosses a threshold.

## Explicitly deferred
- Per-metro Census prefetch.
- Extension MacroBadge polish beyond what shipped in 1.0.6.

## Technical notes
- Standard 402 payload to keep across all functions:
  ```json
  { "error": "...", "code": "QUOTA_EXCEEDED" | "BUDGET_EXCEEDED",
    "surface": "<SurfaceId>", "resetAt": "<ISO>",
    "capType": "daily" | "monthly", "usedUsd": 0, "capUsd": 0 }
  ```
- `completeWithFallback` already throws `FeatureQuotaExceededError` and `BudgetExceededError`; handlers just need to map those to the payload above.
- `owned-property-chat` is the only remaining `rawGateway` caller in a user-facing chat path — migrating it is the highest leverage item left in PR #6.
