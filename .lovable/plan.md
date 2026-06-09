# Migrate Group A surfaces to Sonnet via router

Goal: every chat/assistant edge function returns `claude-sonnet-4-5` (Anthropic direct) rows in `ai_usage_log`. Gemini 2.5 Flash usage → 0. Perplexity remains, but only as a tool Sonnet calls — never as a user-facing assistant.

## Code changes

### 1. Add missing surfaces to `_shared/ai/surfaceConfig.ts`
Existing surfaces cover everything except a few. Add (if not already mapped):
- `calculator_insights`
- `compare_properties_ai`
- `neighborhood_personality`
- `property_assistant`
- `owned_property_chat` (alias for my_properties_strategy if we want — but a dedicated id keeps logs clean)
- `send_weekly_picks`
- `ai_chat` (general consumer chat — distinct from `general_chat` only if we want to keep telemetry split; otherwise reuse `general_chat`)
- `ai_search`
- `ai_analyze` (reuse `extension_listing_analysis` since it's the same bounded-analysis shape)

All map to `gateway:standard` primary (Sonnet) / `gateway:fallback` (Gemini) for free+buyer, premium for investor where it matters.

### 2. Add shared `web_research` Perplexity tool
New file `_shared/ai/tools/webResearch.ts`:
- Exports an AI SDK `tool` (or router-compatible tool spec) with input `{ query: string, recency?: "day"|"week"|"month"|"year" }`.
- `execute` calls `perplexity-chat`'s underlying Perplexity Sonar fetch (extract the existing call into a `_shared/perplexity.ts` helper) and returns `{ answer: string, citations: string[] }`.
- Strips citations from `answer` using the same regex `perplexity-chat` already uses.
- 25s timeout, fail-soft → returns `{ answer: "Live data unavailable.", citations: [] }` on error so Sonnet can keep answering.

### 3. Migrate each function (mechanical, ~10–20 lines each)
Pattern, copied from `investor-brief`:

```ts
import { completeWithFallback, BudgetExceededError } from '../_shared/ai/router.ts';
import { ProviderError } from '../_shared/ai/types.ts';

const result = await completeWithFallback(
  '<surface_id>',
  { system, messages, temperature, responseFormat, tools },
  { userId, tier },
);
```

Drop the direct `fetch(GATEWAY_URL, ...)` and the `'google/gemini-2.5-flash'` literal. Keep prompts, validation, persistence, response shape untouched. Map `BudgetExceededError → 402`, `ProviderError(429) → 429`, other → 502.

Per-function notes:
- **`ai-chat`** — biggest function. Keep the structured-tool path (`MATCH_SCORE`, property tools); just swap the model call. Surface: `general_chat`. Add `web_research` tool to its tool list so Sonnet can pull live market data when needed.
- **`ai-search`** — surface: `general_chat` (or `ai_search` if we want separate telemetry).
- **`ai-analyze`** — already half-migrated (router path exists behind flag). Remove legacy `callAiGateway` fallback so it's router-only. Surface stays `extension_listing_analysis`.
- **`calculator-insights`**, **`compare-properties-ai`**, **`neighborhood-personality`** — all currently `callAiGateway()`. Swap to `completeWithFallback`. Compare keeps `artifact_generation` surface (already wired); the other two get their new surface ids.
- **`owned-property-chat`** — already passes `router` opts to `callAiGateway`. Replace with direct `completeWithFallback('my_properties_strategy', ...)`; drop the `model: 'google/gemini-2.5-flash'` literal.
- **`property-assistant`** — surface: `property_assistant` (new).
- **`preferences-assistant`** — surface: `preferences_assistant` (exists). Direct fetch → router.
- **`send-weekly-picks`** — surface: `alerts_engine` (closest existing fit) or new `send_weekly_picks`. Use `alerts_engine` to avoid surface bloat.
- **`investor-chat`** — keep dual-call architecture; replace the Gemini side with `completeWithFallback('investor_chat', ...)` and add `web_research` tool. Perplexity is no longer called for the user-facing answer — only when Sonnet invokes the tool. Surface: `investor_chat`.

### 4. Chrome extension routing change
`chrome-extension/background.ts` currently picks `perplexity-chat` vs `ai-chat` per request. Change to: every extension call goes to `ai-chat` with an extension marker (`{ source: 'extension', surface: 'extension_listing_analysis' }`). Inside `ai-chat`, when `source === 'extension'`, use surface `extension_listing_analysis` and expose the `web_research` tool. No client-side classification.

Update the dual-route memory afterwards.

## Rollout (2 batches, 1h soak)

All flag secrets follow `AI_ROUTER_<SURFACE>_ENABLED=1` + `AI_ROUTER_<SURFACE>_ROLLOUT_PCT=100`. Already deployed: `preferences_assistant`, `extension_listing_analysis`, `property_valuation_commentary`.

**Batch 1 (T+0):** Flip all surfaces except `investor_chat` and `extension_listing_analysis`. Set `ENABLED=1` and `ROLLOUT_PCT=100` for: `general_chat`, `my_properties_strategy`, `property_assistant`, `artifact_generation`, `alerts_engine`, plus new ones (`calculator_insights`, `compare_properties_ai`, `neighborhood_personality`). `extension_listing_analysis` already on — leave it.

Soak 1h. Watch `ai_usage_log` (Sonnet % climbing), router 5xx rate, 402 spikes, per-tier daily cap hits.

**Batch 2 (T+1h):** Flip `investor_chat` and bump extension behavior (extension already on `extension_listing_analysis` surface; this batch ships the `web_research` tool + extension routing change).

**Abort triggers (same as investor-brief ship):**
- Router 5xx > 3% over 5 min
- p95 latency > 12s for any surface
- 402 rate > 2× baseline
- Anthropic spend cap alarm
Action: drop the offending surface's `ROLLOUT_PCT` to 0 (kill-switch via env var, no redeploy).

## Done definition
- `ai_usage_log` last hour: ≥99% rows model = `claude-sonnet-4-5`, provider = `anthropic` (rest = Perplexity tool calls, image, voice).
- No edge function imports `'google/gemini-2.5-flash'` as a literal (rg check).
- Extension makes one outbound call per user turn (to `ai-chat`), not two.
- Memory updated: drop `arquitetura/estrategia-de-ia-hibrida` Gemini-primary line and `arquitetura/roteamento-de-api-da-extensao-chrome-dual-path`; replace with Sonnet-orchestrates-Perplexity notes.

## Technical details

- `_shared/perplexity.ts` extracted from `perplexity-chat/index.ts` — same timeout, same citation regex, same Zod validation. `perplexity-chat` endpoint stays deployed (used by `web_research` tool internally + legacy callers like `market-comparator`/`market-trends`/`neighborhood-insights`/`get-state-tax-data` which are Group B and keep their direct Perplexity calls).
- Tier mapping helper (already in investor-brief) extracted to `_shared/ai/tier.ts` so every migrated function uses the same `free | buyer | investor` derivation.
- No DB migration required. No new secrets except the per-surface enable/pct env vars (set post-deploy in the rollout step).
- Tests: extend `_shared/ai/__tests__/router_test.ts` with one case per new surface id (asserts `pickModel` returns Sonnet primary for free tier).
