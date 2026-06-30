# PR #6 — Backend Quota Standardization & Router Migration

No new API keys needed. All required secrets (`LOVABLE_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`) are already configured.

## Scope

Three backend changes that close the quota-enforcement loop so the frontend (PR #7) has a consistent contract to parse.

### 1. Migrate `owned-property-chat` to central router
- Replace direct `rawGateway` / provider calls with `completeWithFallback` from `_shared/ai-router.ts`.
- Inherits prompt caching, Haiku routing, budget gating, and telemetry automatically.
- Highest-leverage change: this function is one of the largest remaining un-routed token sinks.

### 2. Standardize 402 responses in `investor-chat` and `investor-brief`
- Use the shared `routerErrorResponse` helper so every quota/budget failure returns:
  - HTTP **402**
  - JSON body `{ code: "QUOTA_EXCEEDED" | "BUDGET_EXCEEDED", message, upgradeUrl }`
- Today these two still return ad-hoc 500/429 shapes, which the frontend cannot parse uniformly.

### 3. Mid-stream 402 handling for SSE endpoints
- For streaming functions (`investor-chat`, `owned-property-chat`), if `usage-gate.ts` trips **after** the stream has started, emit a terminal SSE event `event: quota_exceeded\ndata: {code, message, upgradeUrl}` before closing.
- Lets the frontend show `<BudgetCapBlocker />` even when the cap is hit mid-response.

## Files touched

```text
supabase/functions/owned-property-chat/index.ts   (migrate to completeWithFallback)
supabase/functions/investor-chat/index.ts         (routerErrorResponse + mid-stream 402)
supabase/functions/investor-brief/index.ts        (routerErrorResponse)
supabase/functions/_shared/ai-router.ts           (export emitQuotaSseEvent helper if missing)
```

No DB migrations, no new secrets, no frontend changes (those land in PR #7).

## Verification

- `supabase--curl_edge_functions` against each function with a test user at the budget cap → expect HTTP 402 + standardized body.
- Check `supabase--edge_function_logs` for `owned-property-chat` to confirm router telemetry (cache hit %, model = Haiku on cheap paths).
- Confirm SSE stream emits `event: quota_exceeded` when cap trips mid-response.

## Out of scope (saved for PR #7 / PR #8)

- Frontend `edgeErrors.ts` parser updates and `<BudgetCapBlocker />` wiring.
- 48h prompt-cache hit-rate verification.
- 80%-of-cap alerting.
