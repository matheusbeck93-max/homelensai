/**
 * Per-request context that follows async execution without threading a
 * `req` argument through every helper. Used by the AI router to auto-tag
 * `is_dev_call` in `ai_usage_log` based on the inbound Origin/Referer.
 *
 * Wire once at the top of each `Deno.serve` handler:
 *
 *     Deno.serve((req) => withRequestOrigin(req, () => handler(req)));
 *
 * Any downstream `completeWithFallback` / `streamWithFallback` call will
 * pick up the origin automatically.
 */

import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  origin?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

function extractOrigin(req: Request | null | undefined): string | undefined {
  if (!req) return undefined;
  return req.headers.get("origin") ?? req.headers.get("referer") ?? undefined;
}

export function withRequestOrigin<T>(req: Request | null | undefined, fn: () => T): T {
  return storage.run({ origin: extractOrigin(req) }, fn);
}

export function withExplicitOrigin<T>(origin: string | undefined, fn: () => T): T {
  return storage.run({ origin }, fn);
}

export function getCurrentOrigin(): string | undefined {
  return storage.getStore()?.origin;
}

/**
 * Convenience wrapper for `Deno.serve`. Usage:
 *
 *     Deno.serve(withOrigin(async (req) => { ...handler... }));
 *
 * Establishes the async-local request origin so downstream router calls
 * can auto-tag `is_dev_call` without threading `req` through helpers.
 */
export function withOrigin<H extends (req: Request) => Promise<Response> | Response>(handler: H): H {
  return ((req: Request) => withRequestOrigin(req, () => handler(req))) as H;
}