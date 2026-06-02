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

export type ModelId = "gateway:standard" | "gateway:premium" | "gateway:fallback";

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