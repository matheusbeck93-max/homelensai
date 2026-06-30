/**
 * Cron run logger — every scheduled (or manual) edge function writes one
 * row to `cron_run_log` so we can see what ran, when, how long, and what
 * it cost in AI dollars.
 *
 * Usage:
 *   const start = Date.now();
 *   try {
 *     // ... do the work, sum AI cost as you go ...
 *     await logCronRun({ jobName: "milestone-detector-daily", startedAt: start, aiCostUsd, req });
 *   } catch (err) {
 *     await logCronRun({ jobName: "milestone-detector-daily", startedAt: start, status: "error", errorMessage: String(err), req });
 *     throw err;
 *   }
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

let cachedClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export type CronTrigger = "schedule" | "manual";

export interface CronRunInput {
  jobName: string;
  /** ms timestamp captured at the entrypoint. */
  startedAt: number;
  status?: "ok" | "error" | "skipped";
  aiCostUsd?: number;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  /** Inbound Request — used to infer schedule vs manual. */
  req?: Request;
  /** Explicit trigger override. */
  triggeredBy?: CronTrigger;
}

/**
 * pg_cron uses `net.http_post` with `X-Cron-Secret: $CRON_SHARED_SECRET`.
 * Anything carrying that secret is a scheduled run; everything else is a
 * manual invocation (admin retry, smoke test, etc.).
 */
export function inferTrigger(req?: Request): CronTrigger {
  if (!req) return "manual";
  const secret = Deno.env.get("CRON_SHARED_SECRET");
  const provided = req.headers.get("x-cron-secret") ?? req.headers.get("X-Cron-Secret");
  if (secret && provided && secret === provided) return "schedule";
  // pg_cron jobs sometimes also pass an Authorization Bearer with the anon
  // key — surface as `schedule` only when the explicit cron header is set.
  return "manual";
}

export async function logCronRun(input: CronRunInput): Promise<void> {
  const client = getServiceClient();
  if (!client) return;
  const durationMs = Math.max(0, Date.now() - input.startedAt);
  const triggeredBy = input.triggeredBy ?? inferTrigger(input.req);
  const row = {
    job_name: input.jobName,
    duration_ms: durationMs,
    status: input.status ?? "ok",
    ai_cost_usd: Number((input.aiCostUsd ?? 0).toFixed(6)),
    triggered_by: triggeredBy,
    metadata: {
      ...(input.metadata ?? {}),
      ...(input.errorMessage ? { error: input.errorMessage.slice(0, 500) } : {}),
    },
  };
  try {
    const { error } = await client.from("cron_run_log").insert(row);
    if (error) console.error("[cron-log] insert failed:", error.message);
  } catch (err) {
    console.error("[cron-log] insert threw:", (err as Error)?.message);
  }
}

/**
 * Convenience wrapper: returns true if the function should short-circuit
 * because `PRELAUNCH_PAUSE_BACKGROUND_JOBS=true`. Also writes a "skipped"
 * row to cron_run_log so the pause is observable.
 */
export async function isPausedAndLog(jobName: string, req?: Request, startedAt: number = Date.now()): Promise<boolean> {
  if (Deno.env.get("PRELAUNCH_PAUSE_BACKGROUND_JOBS") !== "true") return false;
  await logCronRun({ jobName, startedAt, status: "skipped", metadata: { reason: "PRELAUNCH_PAUSE_BACKGROUND_JOBS" }, req });
  return true;
}

/**
 * Wraps a Deno.serve handler so every invocation produces one cron_run_log
 * row. OPTIONS (CORS preflight) requests are passed through untouched.
 *
 * Use:
 *   Deno.serve(withCronLog("my-job-name", async (req) => { ... }));
 */
export function withCronLog(
  jobName: string,
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return handler(req) as Response;
    const startedAt = Date.now();
    try {
      const res = await handler(req);
      const status = res.status >= 400 ? "error" : "ok";
      logCronRun({ jobName, startedAt, status, metadata: { http_status: res.status }, req })
        .catch((err) => console.error("[cron-log] wrap log failed:", err));
      return res;
    } catch (err) {
      logCronRun({
        jobName,
        startedAt,
        status: "error",
        errorMessage: (err as Error)?.message ?? String(err),
        req,
      }).catch(() => {});
      throw err;
    }
  };
}