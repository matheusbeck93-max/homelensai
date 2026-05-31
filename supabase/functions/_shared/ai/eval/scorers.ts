/**
 * Scoring primitives for the HomeLens AI eval harness.
 *
 * Each scorer takes the model's textual output (and optionally the full
 * CompleteResult) and returns a 0..1 score plus a short reason.
 * Composite scorers combine multiple checks; the runner averages them.
 */

import type { CompleteResult } from "../types.ts";

export interface ScoreResult {
  score: number; // 0..1
  passed: boolean; // score >= threshold (default 1.0 for boolean scorers)
  reason: string;
}

export type Scorer = (
  result: CompleteResult,
) => ScoreResult | Promise<ScoreResult>;

export function containsAll(needles: string[], opts: { caseInsensitive?: boolean } = {}): Scorer {
  return (r) => {
    const hay = opts.caseInsensitive === false ? r.text : r.text.toLowerCase();
    const norm = (s: string) => (opts.caseInsensitive === false ? s : s.toLowerCase());
    const missing = needles.filter((n) => !hay.includes(norm(n)));
    return {
      score: (needles.length - missing.length) / Math.max(needles.length, 1),
      passed: missing.length === 0,
      reason: missing.length === 0 ? "all substrings present" : `missing: ${missing.join(", ")}`,
    };
  };
}

export function matches(pattern: RegExp): Scorer {
  return (r) => {
    const ok = pattern.test(r.text);
    return { score: ok ? 1 : 0, passed: ok, reason: ok ? `matched ${pattern}` : `no match for ${pattern}` };
  };
}

/**
 * MATCH_SCORE prefix gate (see mem://features/match-score-contract).
 * AI MUST prefix its response with `MATCH_SCORE: X/10`.
 */
export function hasMatchScorePrefix(): Scorer {
  const re = /^\s*MATCH_SCORE:\s*(10|[0-9])\s*\/\s*10\b/;
  return (r) => {
    const m = r.text.match(re);
    if (!m) return { score: 0, passed: false, reason: "missing MATCH_SCORE: X/10 prefix" };
    return { score: 1, passed: true, reason: `MATCH_SCORE=${m[1]}/10` };
  };
}

export function maxLength(maxChars: number): Scorer {
  return (r) => {
    const ok = r.text.length <= maxChars;
    return {
      score: ok ? 1 : Math.max(0, maxChars / r.text.length),
      passed: ok,
      reason: ok ? `len=${r.text.length} <= ${maxChars}` : `len=${r.text.length} > ${maxChars}`,
    };
  };
}

export function isValidJson(): Scorer {
  return (r) => {
    try {
      JSON.parse(r.text);
      return { score: 1, passed: true, reason: "valid JSON" };
    } catch (err) {
      return { score: 0, passed: false, reason: `invalid JSON: ${(err as Error).message}` };
    }
  };
}

export function jsonHasKeys(keys: string[]): Scorer {
  return (r) => {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(r.text) as Record<string, unknown>;
    } catch (err) {
      return { score: 0, passed: false, reason: `invalid JSON: ${(err as Error).message}` };
    }
    const missing = keys.filter((k) => !(k in obj));
    return {
      score: (keys.length - missing.length) / Math.max(keys.length, 1),
      passed: missing.length === 0,
      reason: missing.length === 0 ? "all keys present" : `missing keys: ${missing.join(", ")}`,
    };
  };
}

/** Soft penalty for off-topic terms; useful for the US real-estate scope rule. */
export function refusesTerms(forbidden: string[]): Scorer {
  return (r) => {
    const hay = r.text.toLowerCase();
    const hits = forbidden.filter((t) => hay.includes(t.toLowerCase()));
    return {
      score: hits.length === 0 ? 1 : 0,
      passed: hits.length === 0,
      reason: hits.length === 0 ? "no forbidden terms" : `forbidden terms present: ${hits.join(", ")}`,
    };
  };
}

/** Composite: all scorers must pass; final score is the mean. */
export function all(scorers: Scorer[]): Scorer {
  return async (r) => {
    const results = await Promise.all(scorers.map((s) => s(r)));
    const score = results.reduce((acc, x) => acc + x.score, 0) / Math.max(results.length, 1);
    const passed = results.every((x) => x.passed);
    const reason = results.map((x, i) => `#${i + 1} ${x.passed ? "ok" : "FAIL"}: ${x.reason}`).join(" | ");
    return { score, passed, reason };
  };
}