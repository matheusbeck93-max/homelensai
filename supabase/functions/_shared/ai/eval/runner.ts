/**
 * Eval harness runner.
 *
 * Runs golden-set cases through `completeWithFallback` against a provided
 * ChatProvider (use the real LovableGatewayProvider for CI / manual runs,
 * or a mock for unit tests). Aggregates pass/fail and per-case scores.
 */

import { completeWithFallback } from "../router.ts";
import type { ChatProvider } from "../types.ts";
import { type EvalCase, EVAL_CASES, filterCases } from "./cases.ts";

export interface CaseRunResult {
  id: string;
  surface: string;
  tier: string;
  passed: boolean;
  score: number;
  threshold: number;
  reason: string;
  latencyMs: number;
  errored: boolean;
  errorMessage?: string;
}

export interface EvalSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  meanScore: number;
  results: CaseRunResult[];
}

export interface RunEvalOpts {
  provider: ChatProvider;
  userId?: string;
  cases?: EvalCase[];
  filter?: Parameters<typeof filterCases>[0];
  /** Bypass the daily budget check — required for eval runs. */
  skipBudgetCheck?: boolean;
}

export async function runEval(opts: RunEvalOpts): Promise<EvalSummary> {
  const cases =
    opts.cases ?? (opts.filter ? filterCases(opts.filter) : EVAL_CASES);
  const results: CaseRunResult[] = [];

  for (const c of cases) {
    const threshold = c.threshold ?? 1;
    const t0 = Date.now();
    try {
      const result = await completeWithFallback(
        c.surface,
        c.request,
        { userId: opts.userId ?? "eval-runner", tier: c.tier },
        { provider: opts.provider, skipBudgetCheck: opts.skipBudgetCheck ?? true },
      );
      const scored = await c.scorer(result);
      results.push({
        id: c.id,
        surface: c.surface,
        tier: c.tier,
        passed: scored.passed && scored.score >= threshold,
        score: scored.score,
        threshold,
        reason: scored.reason,
        latencyMs: Date.now() - t0,
        errored: false,
      });
    } catch (err) {
      results.push({
        id: c.id,
        surface: c.surface,
        tier: c.tier,
        passed: false,
        score: 0,
        threshold,
        reason: "provider error",
        latencyMs: Date.now() - t0,
        errored: true,
        errorMessage: (err as Error).message,
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const meanScore =
    results.reduce((acc, r) => acc + r.score, 0) / Math.max(results.length, 1);

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: passed / Math.max(results.length, 1),
    meanScore,
    results,
  };
}

export function formatSummary(summary: EvalSummary): string {
  const lines = [
    `Eval results: ${summary.passed}/${summary.total} passed ` +
      `(${(summary.passRate * 100).toFixed(1)}%), mean score ${summary.meanScore.toFixed(2)}`,
    "",
  ];
  for (const r of summary.results) {
    const status = r.errored ? "ERROR" : r.passed ? "PASS" : "FAIL";
    lines.push(
      `  [${status}] ${r.id} (${r.surface}/${r.tier}) ` +
        `score=${r.score.toFixed(2)}/${r.threshold} ${r.latencyMs}ms — ${r.errorMessage ?? r.reason}`,
    );
  }
  return lines.join("\n");
}