/**
 * AI router — public API every HomeLens surface calls.
 *
 * Resolves the right model for a (surface, tier) pair, runs the provider,
 * and transparently retries against the fallback model on retryable errors.
 * Telemetry (PR #2) and feature flags (PR #4) are stubbed.
 */

import { LovableGatewayProvider } from "./lovableGatewayProvider.ts";
import type { ModelId } from "./modelRegistry.ts";
import {
  getSurfaceConfig,
  type SurfaceId,
} from "./surfaceConfig.ts";
import {
  type ChatProvider,
  type ChatRequest,
  type CompleteResult,
  ProviderError,
  type StreamEvent,
  type Tier,
  type Usage,
} from "./types.ts";

export interface RouterContext {
  userId: string;
  tier: Tier;
  signal?: AbortSignal;
}

export interface RouterOptions {
  /** Override the provider — used by tests. Defaults to LovableGatewayProvider. */
  provider?: ChatProvider;
}

export function pickModel(
  surface: SurfaceId,
  tier: Tier,
): { primary: ModelId; fallback: ModelId } {
  const cfg = getSurfaceConfig(surface);
  const tierCfg = cfg.tiers[tier];
  return { primary: tierCfg.primary, fallback: tierCfg.fallback };
}

/**
 * PR #4 will wire real flags. For now every surface is dormant — no surface
 * imports the router yet, so the stub is fine.
 */
export function isFlagOn(_surface: SurfaceId, _userId: string): boolean {
  return false;
}

/**
 * PR #2 will land the `ai_usage_log` table. Until then this is a no-op
 * (writes a debug log line so we can verify the hook fires in dev).
 */
function logUsage(_surface: SurfaceId, _ctx: RouterContext, usage: Usage, attempt: "primary" | "fallback"): void {
  if (Deno.env.get("AI_ROUTER_DEBUG") === "1") {
    console.log(
      `[ai-router] surface=${_surface} model=${usage.modelId} attempt=${attempt} ` +
        `in=${usage.inputTokens} out=${usage.outputTokens} cost=$${usage.costUsd}`,
    );
  }
}

function defaultProvider(): ChatProvider {
  return new LovableGatewayProvider();
}

export async function completeWithFallback(
  surface: SurfaceId,
  req: ChatRequest,
  ctx: RouterContext,
  opts: RouterOptions = {},
): Promise<CompleteResult> {
  const provider = opts.provider ?? defaultProvider();
  const { primary, fallback } = pickModel(surface, ctx.tier);

  try {
    const result = await provider.complete(primary, req, ctx.signal);
    logUsage(surface, ctx, result.usage, "primary");
    return result;
  } catch (err) {
    if (err instanceof ProviderError && err.retryable) {
      const result = await provider.complete(fallback, req, ctx.signal);
      logUsage(surface, ctx, result.usage, "fallback");
      return result;
    }
    throw err;
  }
}

export async function* streamWithFallback(
  surface: SurfaceId,
  req: ChatRequest,
  ctx: RouterContext,
  opts: RouterOptions = {},
): AsyncIterable<StreamEvent> {
  const provider = opts.provider ?? defaultProvider();
  const { primary, fallback } = pickModel(surface, ctx.tier);

  // Buffer events from the primary stream so we can fall through cleanly
  // if it fails before producing any non-error output.
  let producedOutput = false;
  let primaryUsage: Usage | undefined;
  let primaryError: Extract<StreamEvent, { type: "error" }> | undefined;

  for await (const ev of provider.stream(primary, req, ctx.signal)) {
    if (ev.type === "error") {
      primaryError = ev;
      break;
    }
    if (ev.type === "done") {
      primaryUsage = ev.usage;
      break;
    }
    producedOutput = true;
    yield ev;
  }

  if (!primaryError) {
    if (primaryUsage) logUsage(surface, ctx, primaryUsage, "primary");
    yield { type: "done", usage: primaryUsage };
    return;
  }

  // Only fall through when the error is retryable AND we haven't already
  // streamed partial output (mid-stream switching would corrupt the UX).
  if (!primaryError.retryable || producedOutput) {
    yield primaryError;
    return;
  }

  let fallbackUsage: Usage | undefined;
  for await (const ev of provider.stream(fallback, req, ctx.signal)) {
    if (ev.type === "done") {
      fallbackUsage = ev.usage;
      break;
    }
    if (ev.type === "error") {
      yield ev;
      return;
    }
    yield ev;
  }
  if (fallbackUsage) logUsage(surface, ctx, fallbackUsage, "fallback");
  yield { type: "done", usage: fallbackUsage };
}