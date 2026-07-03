/**
 * AI router — public API every HomeLens surface calls.
 *
 * Resolves the right model for a (surface, tier) pair, runs the provider,
 * and transparently retries against the fallback model on retryable errors.
 * Telemetry (PR #2) and feature flags (PR #4) are stubbed.
 */

import { LovableGatewayProvider } from "./lovableGatewayProvider.ts";
import { AnthropicProvider } from "./anthropicProvider.ts";
import { getModelSpec, type ModelId } from "./modelRegistry.ts";
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
import { getFlagDecision, isSurfaceEnabled } from "./featureFlags.ts";
import { checkAndIncrementFeatureQuota, FeatureQuotaExceededError, type FeatureKind } from "../usage-gate.ts";
import { getCurrentOrigin } from "./requestContext.ts";

export { BudgetExceededError, FeatureQuotaExceededError };
export { getFlagDecision, isSurfaceEnabled };

export interface RouterContext {
  userId: string;
  tier: Tier;
  signal?: AbortSignal;
  /** Optional upstream request id for correlating logs with edge requests. */
  requestId?: string;
  isDevCall?: boolean;
  /** Origin/Referer of the upstream request — used to auto-tag dev calls. */
  origin?: string;
}
const DEV_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
  /\.lovable\.app$/i,
  /\.lovableproject\.com$/i,
  /lovable\.dev$/i,
];

/**
 * Decide whether a request should be tagged is_dev_call=true. Explicit
 * `isDevCall` always wins; otherwise we infer from the Origin/Referer.
 * Called from `completeWithFallback` / `streamWithFallback`.
 */
export function isDevOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  const trimmed = origin.trim();
  return DEV_ORIGIN_PATTERNS.some((rx) => rx.test(trimmed));
}

function resolveIsDevCall(ctx: RouterContext): boolean {
  if (typeof ctx.isDevCall === "boolean") return ctx.isDevCall;
  // Prefer explicit ctx.origin, fall back to AsyncLocalStorage-scoped
  // request origin. That lets deep helpers call the router without
  // threading `req` through every intermediate function.
  const origin = ctx.origin ?? getCurrentOrigin();
  return isDevOrigin(origin);
}

/**
 * Convenience builder used by edge functions: pass the inbound Request and
 * we'll extract the origin so the router can auto-tag dev calls.
 */
export function buildRouterContext(
  base: Omit<RouterContext, "origin">,
  req?: Request,
): RouterContext {
  const origin = req
    ? req.headers.get("origin") ?? req.headers.get("referer") ?? undefined
    : undefined;
  return { ...base, origin };
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

/** @deprecated Use isSurfaceEnabled from ./featureFlags.ts. Kept as a thin re-export for back-compat. */
export function isFlagOn(surface: SurfaceId, userId: string): boolean {
  return isSurfaceEnabled(surface, userId);
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
    isDevCall: resolveIsDevCall(ctx),
  });
}

function zeroUsage(modelId: ModelId): Usage {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0, modelId };
}

function defaultProvider(): ChatProvider {
  return new DispatchingProvider();
}

/**
 * Dispatches each call to the concrete provider declared on the model spec.
 * Lets the registry decide which backend (Lovable Gateway vs Anthropic
 * direct) serves a given ModelId without surfaces or the router caring.
 */
class DispatchingProvider implements ChatProvider {
  private gateway: ChatProvider | null = null;
  private anthropic: ChatProvider | null = null;

  private resolve(modelId: ModelId): ChatProvider {
    const spec = getModelSpec(modelId);
    if (spec.provider === "anthropic") {
      if (!this.anthropic) this.anthropic = new AnthropicProvider();
      return this.anthropic;
    }
    if (!this.gateway) this.gateway = new LovableGatewayProvider();
    return this.gateway;
  }

  complete(modelId: ModelId, req: ChatRequest, signal?: AbortSignal) {
    return this.resolve(modelId).complete(modelId, req, signal);
  }

  stream(modelId: ModelId, req: ChatRequest, signal?: AbortSignal) {
    return this.resolve(modelId).stream(modelId, req, signal);
  }
}

async function enforceBudget(ctx: RouterContext, opts: RouterOptions): Promise<BudgetStatus | null> {
  if (opts.skipBudgetCheck) return null;
  const status = await checkBudget(ctx.userId, ctx.tier, { isDevCall: resolveIsDevCall(ctx) });
  if (!status.allowed) {
    const capType = status.capType ?? "daily";
    const used = capType === "monthly" ? (status.monthlyUsedUsd ?? 0) : status.usedUsd;
    const cap = capType === "monthly" ? (status.monthlyCapUsd ?? 0) : status.capUsd;
    throw new BudgetExceededError(
      status.tier,
      used,
      cap,
      undefined,
      undefined,
      capType,
      status.monthlyUsedUsd ?? 0,
      status.monthlyCapUsd ?? 0,
    );
  }
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

  // Feature-level quota enforcement (PR #2)
  if (ctx.userId && !opts.skipBudgetCheck && !resolveIsDevCall(ctx)) {
    let feature: FeatureKind = "chat";
    if (surface === "investor_brief") feature = "briefs";
    else if (surface === "extension_listing_analysis") feature = "photos";
    
    try {
      const fGate = await checkAndIncrementFeatureQuota(ctx.userId, ctx.tier, feature);
      if (!fGate.allowed) {
        throw new FeatureQuotaExceededError(ctx.tier, feature, 0);
      }
    } catch (err) {
      if (err instanceof FeatureQuotaExceededError) throw err;
    }
  }

  try {
    await enforceBudget(ctx, opts);
  } catch (err) {
    // Stamp the surface so the structured 402 payload can route the user
    // to the right upgrade-source attribution.
    if (err instanceof BudgetExceededError && !err.surface) {
      throw new BudgetExceededError(
        err.tier,
        err.usedUsd,
        err.capUsd,
        surface,
        err.resetAt,
        err.capType,
        err.monthlyUsedUsd,
        err.monthlyCapUsd,
      );
    }
    throw err;
  }

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

  // Feature-level quota enforcement (PR #2)
  if (ctx.userId && !opts.skipBudgetCheck && !resolveIsDevCall(ctx)) {
    let feature: FeatureKind = "chat";
    if (surface === "investor_brief") feature = "briefs";
    else if (surface === "extension_listing_analysis") feature = "photos";
    
    try {
      const fGate = await checkAndIncrementFeatureQuota(ctx.userId, ctx.tier, feature);
      if (!fGate.allowed) {
        throw new FeatureQuotaExceededError(ctx.tier, feature, 0);
      }
    } catch (err) {
      if (err instanceof FeatureQuotaExceededError) throw err;
    }
  }

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