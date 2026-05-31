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
import { logUsageAsync } from "./usageLogger.ts";
import { BudgetExceededError, checkBudget, type BudgetStatus } from "./budgetGuard.ts";

export interface RouterContext {
  userId: string;
  tier: Tier;
  signal?: AbortSignal;
  /** Optional upstream request id for correlating logs with edge requests. */
  requestId?: string;
}

export interface RouterOptions {
  /** Override the provider — used by tests. Defaults to LovableGatewayProvider. */
  provider?: ChatProvider;
  /** Skip the daily budget guard. Used by tests and admin tools. */
  skipBudgetCheck?: boolean;
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

function logUsage(
  surface: SurfaceId,
  ctx: RouterContext,
  usage: Usage,
  attempt: "primary" | "fallback",
  latencyMs?: number,
  status: "ok" | "error" = "ok",
  errorCode?: string,
): void {
  if (Deno.env.get("AI_ROUTER_DEBUG") === "1") {
    console.log(
      `[ai-router] surface=${surface} model=${usage.modelId} attempt=${attempt} ` +
        `in=${usage.inputTokens} out=${usage.outputTokens} cost=$${usage.costUsd} ` +
        `latency=${latencyMs ?? "?"}ms status=${status}`,
    );
  }
  if (!ctx.userId) return;
  logUsageAsync({
    userId: ctx.userId,
    surface,
    tier: ctx.tier,
    usage,
    attempt,
    latencyMs,
    status,
    errorCode,
    requestId: ctx.requestId,
  });
}

function zeroUsage(modelId: ModelId): Usage {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0, modelId };
}

function defaultProvider(): ChatProvider {
  return new LovableGatewayProvider();
}

async function enforceBudget(ctx: RouterContext, opts: RouterOptions): Promise<BudgetStatus | null> {
  if (opts.skipBudgetCheck) return null;
  const status = await checkBudget(ctx.userId, ctx.tier);
  if (!status.allowed) throw new BudgetExceededError(status.tier, status.usedUsd, status.capUsd);
  return status;
}

export async function completeWithFallback(
  surface: SurfaceId,
  req: ChatRequest,
  ctx: RouterContext,
  opts: RouterOptions = {},
): Promise<CompleteResult> {
  const provider = opts.provider ?? defaultProvider();
  const { primary, fallback } = pickModel(surface, ctx.tier);
  await enforceBudget(ctx, opts);

  const t0 = Date.now();
  try {
    const result = await provider.complete(primary, req, ctx.signal);
    logUsage(surface, ctx, result.usage, "primary", Date.now() - t0);
    return result;
  } catch (err) {
    const primaryLatency = Date.now() - t0;
    if (err instanceof ProviderError && err.retryable) {
      logUsage(surface, ctx, zeroUsage(primary), "primary", primaryLatency, "error", String(err.status));
      const t1 = Date.now();
      try {
        const result = await provider.complete(fallback, req, ctx.signal);
        logUsage(surface, ctx, result.usage, "fallback", Date.now() - t1);
        return result;
      } catch (err2) {
        const code = err2 instanceof ProviderError ? String(err2.status) : "unknown";
        logUsage(surface, ctx, zeroUsage(fallback), "fallback", Date.now() - t1, "error", code);
        throw err2;
      }
    }
    const code = err instanceof ProviderError ? String(err.status) : "unknown";
    logUsage(surface, ctx, zeroUsage(primary), "primary", primaryLatency, "error", code);
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
  try {
    await enforceBudget(ctx, opts);
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      yield { type: "error", message: err.message, retryable: false, status: 402 };
      return;
    }
    throw err;
  }

  // Buffer events from the primary stream so we can fall through cleanly
  // if it fails before producing any non-error output.
  let producedOutput = false;
  let primaryUsage: Usage | undefined;
  let primaryError: Extract<StreamEvent, { type: "error" }> | undefined;
  const t0 = Date.now();

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
    if (primaryUsage) logUsage(surface, ctx, primaryUsage, "primary", Date.now() - t0);
    yield { type: "done", usage: primaryUsage };
    return;
  }

  // Only fall through when the error is retryable AND we haven't already
  // streamed partial output (mid-stream switching would corrupt the UX).
  if (!primaryError.retryable || producedOutput) {
    logUsage(
      surface,
      ctx,
      zeroUsage(primary),
      "primary",
      Date.now() - t0,
      "error",
      primaryError.status ? String(primaryError.status) : "stream_error",
    );
    yield primaryError;
    return;
  }

  logUsage(
    surface,
    ctx,
    zeroUsage(primary),
    "primary",
    Date.now() - t0,
    "error",
    primaryError.status ? String(primaryError.status) : "stream_error",
  );

  let fallbackUsage: Usage | undefined;
  const t1 = Date.now();
  for await (const ev of provider.stream(fallback, req, ctx.signal)) {
    if (ev.type === "done") {
      fallbackUsage = ev.usage;
      break;
    }
    if (ev.type === "error") {
      logUsage(
        surface,
        ctx,
        zeroUsage(fallback),
        "fallback",
        Date.now() - t1,
        "error",
        ev.status ? String(ev.status) : "stream_error",
      );
      yield ev;
      return;
    }
    yield ev;
  }
  if (fallbackUsage) logUsage(surface, ctx, fallbackUsage, "fallback", Date.now() - t1);
  yield { type: "done", usage: fallbackUsage };
}