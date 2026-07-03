/**
 * Canonical model registry for the HomeLens AI router.
 *
 * Single source of truth for which model identifiers the surfaceConfig +
 * router can reference, and what each one resolves to on the Lovable AI
 * Gateway.
 *
 * The router and provider read `apiName` and `reasoningEffort` from here;
 * cost numbers are placeholders until PR #2 (telemetry) confirms pricing.
 */

export type ModelId =
  | "gateway:standard"
  | "gateway:premium"
  | "gateway:fallback"
  | "gateway:haiku"
  | "gateway:flash_lite";

export type ProviderName = "lovable_gateway" | "anthropic";

export interface ModelSpec {
  id: ModelId;
  /** Which ChatProvider handles this model. */
  provider: ProviderName;
  /** Lovable AI Gateway model string (sent in the `model` field). */
  apiName: string;
  /** Forwarded as `reasoning_effort` in the request body when set. */
  reasoningEffort?: "low" | "medium" | "high";
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  /** Placeholder USD pricing per 1M tokens — replace in PR #2. */
  costPerMTokIn: number;
  costPerMTokOut: number;
}

/**
 * All tiers/surfaces resolve to Claude Sonnet via Anthropic direct. Cost
 * control is handled by per-tier daily $ caps in budgetGuard. The three
 * ModelId aliases are preserved (instead of being collapsed to one) so
 * existing surfaceConfig wiring, telemetry rows, and tests stay stable.
 */
const SONNET_API_NAME = "claude-sonnet-4-5";
const SONNET_BASE = {
  provider: "anthropic" as const,
  apiName: SONNET_API_NAME,
  contextWindow: 200_000,
  supportsTools: true,
  supportsVision: true,
  // Anthropic published pricing for Sonnet 4.x: $3 / $15 per 1M tokens.
  costPerMTokIn: 3,
  costPerMTokOut: 15,
};

export const MODEL_REGISTRY: Record<ModelId, ModelSpec> = {
  "gateway:standard": {
    id: "gateway:standard",
    ...SONNET_BASE,
  },
  "gateway:premium": {
    id: "gateway:premium",
    ...SONNET_BASE,
  },
  "gateway:fallback": {
    id: "gateway:fallback",
    ...SONNET_BASE,
  },
  "gateway:haiku": {
    id: "gateway:haiku",
    provider: "anthropic",
    apiName: "claude-haiku-4-5",
    contextWindow: 200_000,
    supportsTools: true,
    supportsVision: true,
    costPerMTokIn: 0.80,
    costPerMTokOut: 4.00,
  },
  // PR #8 Option B: route the 4 background-classification ops through the
  // Lovable AI Gateway on Gemini 3.1 Flash Lite (cheaper than Haiku, on
  // Lovable billing). Not user-facing — never used for reasoning surfaces.
  "gateway:flash_lite": {
    id: "gateway:flash_lite",
    provider: "lovable_gateway",
    apiName: "google/gemini-3.1-flash-lite",
    contextWindow: 1_000_000,
    supportsTools: true,
    supportsVision: true,
    costPerMTokIn: 0.10,
    costPerMTokOut: 0.40,
  },
};

/**
 * @deprecated Not read anywhere. `surfaceConfig.ts` is the single source
 * of truth for surface → model routing (see `pickModel` in `router.ts`).
 * Kept only so external consumers (docs, dashboards) that imported this
 * map don't 500 during a rolling deploy. Delete after 2026-08-01.
 */
export const MODEL_BY_OPERATION: Record<string, ModelId> = {
  photo_categorization: "gateway:flash_lite",
  followup_ranking: "gateway:flash_lite",
  intent_detection: "gateway:flash_lite",
  memory_categorization: "gateway:flash_lite",
};

export function getModelSpec(id: ModelId): ModelSpec {
  const spec = MODEL_REGISTRY[id];
  if (!spec) throw new Error(`Unknown model id: ${id}`);
  return spec;
}

export function estimateCostUsd(
  id: ModelId,
  inputTokens: number,
  outputTokens: number,
): number {
  const spec = getModelSpec(id);
  const inCost = (inputTokens / 1_000_000) * spec.costPerMTokIn;
  const outCost = (outputTokens / 1_000_000) * spec.costPerMTokOut;
  return Number((inCost + outCost).toFixed(6));
}

/**
 * Perplexity pricing — USD per 1K tokens. The `perplexity-chat` edge
 * function does not use the Lovable router, so it logs to `ai_usage_log`
 * directly via this helper. Source: https://docs.perplexity.ai/guides/pricing
 * (values current as of 2026-06; update here if Perplexity revises).
 */
export const PERPLEXITY_PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  "sonar":              { inputPer1k: 0.001, outputPer1k: 0.001 },
  "sonar-pro":          { inputPer1k: 0.003, outputPer1k: 0.015 },
  "sonar-reasoning":    { inputPer1k: 0.001, outputPer1k: 0.005 },
  "sonar-reasoning-pro":{ inputPer1k: 0.002, outputPer1k: 0.008 },
  "sonar-deep-research":{ inputPer1k: 0.002, outputPer1k: 0.008 },
};

export function perplexityCostUsd(
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined | null,
): number {
  const price = PERPLEXITY_PRICING[model] ?? PERPLEXITY_PRICING["sonar"];
  const promptTokens = Number(usage?.prompt_tokens ?? 0) || 0;
  const completionTokens = Number(usage?.completion_tokens ?? 0) || 0;
  const cost = (promptTokens / 1000) * price.inputPer1k + (completionTokens / 1000) * price.outputPer1k;
  return Number(cost.toFixed(6));
}