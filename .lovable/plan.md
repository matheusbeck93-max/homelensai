## Goal

Make `perplexity-chat` participate in the same cap system as `ai-chat` so its spend shows up on the header chip, Overview card, and `/account/usage`, and so it can trigger the 402 BudgetCapBlocker once a tier exceeds its daily or monthly cap.

Scope: backend-only. No UI changes. Out of scope: any extension changes (the extension never calls `perplexity-chat` today — that's documented as a finding, not work).

## Current state

- `ai-chat` (main app + extension): routes through Lovable Gateway. The router path runs `checkBudget` (daily + monthly) before the call and `logAiUsage` after, writing to `ai_usage_log`. Fallback `fetch` paths still go through `precheckAiCredits` / `deductAiCredits`.
- `perplexity-chat` (main app only — neighborhood insights, conversational search, follow-ups): calls `https://api.perplexity.ai/chat/completions` directly. Only `precheckAiCredits` + `deductAiCredits` run. It does NOT call `checkBudget` and does NOT write to `ai_usage_log`, so Perplexity spend is invisible to the new cap system.

## Changes

### 1. `supabase/functions/_shared/ai/budgetGuard.ts`

- Confirm `checkBudget(userId, tier, surface, svc)` and `logAiUsage({ userId, surface, model, provider, costUsd, ... })` are exported and accept a `provider: 'perplexity'` value. If `provider` is currently a closed union of gateway providers, widen it to include `'perplexity'` so cost rows tag correctly.
- No change to cap thresholds.

### 2. `supabase/functions/perplexity-chat/index.ts`

For both Perplexity call sites (lines ~171 and ~497):

1. Resolve `userId` and `tier` from the Authorization header the same way `property-assistant` does (anon `supabase-js` client + `auth.getUser()` + `profiles.subscription_status` normalized via the same `paid → buyer`, `premium → investor` mapping).
2. Before the `fetch` to Perplexity, call `checkBudget(userId, tier, surface, svc)`. Surfaces:
   - Main conversational path → `'general_chat'`.
   - Property-scoped / neighborhood path (the one that emits `MATCH_SCORE`) → reuse the same surface name `ai-chat` uses for that flow (`'general_chat'` if unsure — pick the value that matches what the Usage page already groups under "Perplexity search").
3. If `checkBudget` throws `BudgetExceededError`, return `buildBudgetExceededPayload(err)` as a 402 JSON response with `corsHeaders`. The existing front-end `BudgetCapBlocker` already handles this shape.
4. After a successful Perplexity response, compute cost from token usage using a Perplexity price table (input/output USD per 1K tokens for `sonar` / `sonar-pro` — start with documented public rates; constant lives in `_shared/ai/modelRegistry.ts` under a new `perplexity` section).
5. Call `logAiUsage({ userId, surface, model: <sonar variant used>, provider: 'perplexity', costUsd, inputTokens, outputTokens, requestId })`. This is the single write to `ai_usage_log` that feeds `budget-status` and `usage-summary`.
6. Keep the existing `deductAiCredits(creditCheck, data.usage)` call — credits stay in sync with the legacy counter; the new system reads `ai_usage_log` independently, so both coexist without double-counting against the cap.
7. On Perplexity HTTP errors (non-2xx) and timeouts: do NOT call `logAiUsage` (no spend occurred), and surface the existing error response unchanged.

### 3. `supabase/functions/_shared/ai/modelRegistry.ts`

Add a `PERPLEXITY_PRICING` block:

```ts
export const PERPLEXITY_PRICING = {
  'sonar':            { inputPer1k: 0.001, outputPer1k: 0.001 },
  'sonar-pro':        { inputPer1k: 0.003, outputPer1k: 0.015 },
  'sonar-reasoning':  { inputPer1k: 0.001, outputPer1k: 0.005 },
} as const;

export function perplexityCostUsd(model: string, usage: { prompt_tokens?: number; completion_tokens?: number }) { ... }
```

Use the actual model strings the existing `perplexity-chat` requests send. Numbers above are placeholders — pull current rates from Perplexity's pricing docs.

### 4. Tests — `supabase/functions/_shared/ai/__tests__/budgetGuard_test.ts`

Add two cases:

- `buildBudgetExceededPayload — perplexity provider tags surface correctly` — confirms `surface: 'general_chat'` cap-hit payloads still produce the right upgrade/topup blocks when triggered from the Perplexity path.
- `perplexityCostUsd — computes input + output cost` — unit-tests the new pricing helper for `sonar` and `sonar-pro`.

### 5. Documentation

- `.lovable/memory/faturamento/planos-de-assinatura-e-tiers-premium-free.md` — append a note: "Perplexity calls (`perplexity-chat`) also count against daily + monthly caps via `ai_usage_log`. Provider tag: `perplexity`."
- `docs/telemetry/usage-events.md` — no new event names; add a one-line note under the existing surface table that "perplexity" appears in `provider` column of `ai_usage_log`.

## Verification

1. `supabase--test_edge_functions` on `_shared/ai` to ensure existing budget-guard tests + new ones pass.
2. `supabase--deploy_edge_functions` for `perplexity-chat` only.
3. `supabase--curl_edge_functions` POST `/perplexity-chat` as the preview user; then `supabase--read_query` on `ai_usage_log` to confirm a new row with `provider = 'perplexity'`, non-zero `cost_usd`, today's `usage_date`.
4. Hit `/account/usage` in preview: Perplexity row should appear in the Surface Breakdown and the Today total should match `budget-status.usage_today_usd`.
5. Manually inflate `ai_usage_log` for a test user above their daily cap and re-call `perplexity-chat`: expect 402 with `error: 'budget_exceeded'`, `cap_type: 'daily'`.

## Files

- Edit `supabase/functions/perplexity-chat/index.ts`
- Edit `supabase/functions/_shared/ai/modelRegistry.ts`
- Edit `supabase/functions/_shared/ai/budgetGuard.ts` (only if `provider` union needs widening)
- Edit `supabase/functions/_shared/ai/__tests__/budgetGuard_test.ts`
- Edit `.lovable/memory/faturamento/planos-de-assinatura-e-tiers-premium-free.md`
- Edit `docs/telemetry/usage-events.md`
