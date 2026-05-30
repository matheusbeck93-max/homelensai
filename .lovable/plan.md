
# PR #1 — AI Provider Abstraction (Foundation)

Build the routing layer that future surface migrations will plug into. **No edge function is migrated in this PR** — the abstraction lands dormant. Once it merges, subsequent PRs flip surfaces one at a time behind flags.

## Tier mapping (locked)

- `gateway:standard` → `openai/gpt-5` with `reasoning_effort: "medium"`
- `gateway:premium`  → `openai/gpt-5` with `reasoning_effort: "high"`
- Fallback for both → `google/gemini-2.5-pro` (single-family fallback if GPT-5 returns 5xx or quota-exhausts)

Haiku-class models are not registered. The floor is GPT-5 medium.

## Files

### 1. `supabase/functions/_shared/ai/modelRegistry.ts` (new)
Canonical model identifiers + metadata. Single source of truth.
```ts
export type ModelId = "gateway:standard" | "gateway:premium" | "gateway:fallback";
export interface ModelSpec {
  id: ModelId;
  apiName: string;              // "openai/gpt-5" | "google/gemini-2.5-pro"
  reasoningEffort?: "low" | "medium" | "high";
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  costPerMTokIn: number;        // best-guess until gateway confirms
  costPerMTokOut: number;
}
export const MODEL_REGISTRY: Record<ModelId, ModelSpec> = { ... };
```

### 2. `supabase/functions/_shared/ai/surfaceConfig.ts` (new)
Per-surface tier → model mapping. Matches the inventory prompt's surface IDs.
```ts
export type SurfaceId =
  | "general_chat" | "extension_listing_analysis" | "investor_chat"
  | "investor_brief" | "preferences_assistant" | "my_properties_strategy"
  | "artifact_generation" | "alerts_engine" | "property_valuation_commentary";

export interface SurfaceTierConfig {
  primary: ModelId;
  fallback: ModelId;
  restrictions?: { maxArtifactsPerDay?: number; kinds?: string[] };
}
export interface SurfaceConfig {
  description: string;
  tiers: { free: SurfaceTierConfig; paid: SurfaceTierConfig; premium: SurfaceTierConfig };
  maxToolIterations: number;
}
export const SURFACE_CONFIG: Record<SurfaceId, SurfaceConfig> = { ... };
```
Tier choices follow the inventory prompt: chat/brief/strategy/artifacts/alerts get premium-tier `gateway:premium`; preferences/extension/valuation stay on `gateway:standard` across tiers.

### 3. `supabase/functions/_shared/ai/types.ts` (new)
Shared types for the provider interface.
```ts
export type Tier = "free" | "paid" | "premium";
export interface ChatMessage { role: "system"|"user"|"assistant"|"tool"; content: string; tool_call_id?: string; ... }
export interface ChatTool { name: string; description: string; parameters: unknown; }
export interface ChatRequest { system?: string; messages: ChatMessage[]; tools?: ChatTool[]; maxTokens?: number; temperature?: number; responseFormat?: "json"; }
export type StreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_use_start"; id: string; name: string; input: any }
  | { type: "tool_use_result"; id: string; name: string; output: any }
  | { type: "done"; usage?: { inputTokens: number; outputTokens: number; costUsd: number } }
  | { type: "error"; message: string; retryable: boolean };
export interface ChatProvider {
  stream(modelId: ModelId, req: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamEvent>;
  complete(modelId: ModelId, req: ChatRequest, signal?: AbortSignal): Promise<{ text: string; toolCalls?: any[]; usage: { inputTokens: number; outputTokens: number; costUsd: number } }>;
}
```

### 4. `supabase/functions/_shared/ai/lovableGatewayProvider.ts` (new)
The single concrete `ChatProvider`. Wraps `https://ai.gateway.lovable.dev/v1/chat/completions`.
- Reads `LOVABLE_API_KEY` from env.
- Sends `Lovable-API-Key` header (NOT `Authorization: Bearer`).
- Translates the abstract `ChatRequest` to the OpenAI-compatible payload the gateway expects.
- Forwards `reasoningEffort` from the model spec as `reasoning_effort` in the request body.
- Parses SSE for `stream()`; collects to final response for `complete()`.
- Maps OpenAI-compatible `tool_calls` deltas to our `StreamEvent` shape.
- Computes `costUsd` from `usage` + `MODEL_REGISTRY[id]` rates.
- Surfaces 429 / 402 as `StreamEvent { type: "error", retryable: true|false }`.

### 5. `supabase/functions/_shared/ai/router.ts` (new)
The public API every surface will call.
```ts
export function pickModel(surface: SurfaceId, tier: Tier): { primary: ModelId; fallback: ModelId };

export async function* streamWithFallback(
  surface: SurfaceId,
  req: ChatRequest,
  ctx: { userId: string; tier: Tier; signal?: AbortSignal },
): AsyncIterable<StreamEvent>;

export async function completeWithFallback(
  surface: SurfaceId,
  req: ChatRequest,
  ctx: { userId: string; tier: Tier; signal?: AbortSignal },
): Promise<CompleteResult>;
```
- Resolves tier via `surfaceConfig`, calls primary, on retryable error transparently retries against `fallback` once.
- Emits a single terminal `done` event with merged usage from whichever attempt produced output.
- **Telemetry hook left as a no-op `logUsage()` call** — actual `ai_usage_log` table lands in PR #2.
- **Feature-flag check left as a stub `isFlagOn(surface, userId)`** that returns `false` until PR #4. No surface invokes the router yet, so the stub is fine.

### 6. `supabase/functions/_shared/ai/__tests__/lovableGatewayProvider_test.ts` (new)
Deno tests with mocked `fetch`:
- Streaming path parses SSE deltas correctly.
- Tool-call deltas reassemble into `tool_use_start` / `tool_use_result`.
- 429 → `{ type: "error", retryable: true }`.
- 402 → `{ type: "error", retryable: false }`.
- `reasoning_effort` is forwarded from model spec.
- `complete()` returns final text + usage.

### 7. `supabase/functions/_shared/ai/__tests__/router_test.ts` (new)
- `pickModel("investor_chat", "premium")` returns `gateway:premium` / `gateway:standard`.
- `streamWithFallback` falls through to fallback model on retryable error.
- Non-retryable error (402) does NOT fall through.

## Out of scope (deferred to later PRs)

- `ai_usage_log` table, RLS, dashboard → **PR #2**.
- Daily budget caps + free-tier cap UX → **PR #3**.
- Feature-flag plumbing + `feature_flags` table → **PR #4**.
- Eval harness + golden set → **PR #5**.
- Any edge function actually calling `streamWithFallback` → **PRs #6+**.
- Client-side / no `src/lib/ai/*` mirror in this PR. The migration prompt calls for the router to live in edge-function land where the LLM calls already happen; no client code touches it.

## Verification

1. `deno test supabase/functions/_shared/ai/` passes.
2. Type-check passes (no edge function imports from the new module yet, so no behavior change anywhere).
3. Manual smoke: invoke `completeWithFallback("preferences_assistant", { messages: [{ role: "user", content: "hi" }] }, { userId, tier: "free" })` from a one-shot test edge function (deleted before merge) — confirm GPT-5 medium returns text and `reasoning_effort: "medium"` appears in the gateway log.
4. Grep audit confirms no production code imports from `_shared/ai/` yet — the abstraction is fully dormant.

## Open questions logged but not blocking PR #1

- Exact `costPerMTokIn/Out` for GPT-5 medium vs high — using public OpenAI pricing as placeholder; replace with confirmed gateway pricing in PR #2 when the usage log is built.
- Whether the gateway passes through `reasoning_effort` for `openai/gpt-5` — assumed yes per OpenAI-compatible spec; test #3 above verifies. If not, router falls back to single-effort GPT-5 and the standard/premium distinction collapses to fallback-model differentiation only. Will surface in PR #1 testing.
- Whether `google/gemini-2.5-pro` tool-call format matches OpenAI tool-call schema. Provider adapter normalizes both; tests cover both.

After approval I will create PR #1 only — write the 7 files, run the tests, and stop. PRs #2 onward will be separate plans.
