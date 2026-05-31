import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { ModelId } from "../modelRegistry.ts";
import type {
  ChatProvider,
  ChatRequest,
  CompleteResult,
} from "../types.ts";
import { EVAL_CASES, filterCases } from "../eval/cases.ts";
import { formatSummary, runEval } from "../eval/runner.ts";

/**
 * Scripted provider that returns a canned response keyed on the case id we
 * smuggle via the first user message. Lets us exercise the harness end-to-end
 * without hitting the real gateway.
 */
function scriptedProvider(answers: Record<string, string>): ChatProvider {
  return {
    async complete(modelId: ModelId, req: ChatRequest): Promise<CompleteResult> {
      const userText = req.messages.find((m) => m.role === "user")?.content ?? "";
      const matchKey = Object.keys(answers).find((k) => userText.includes(k));
      const text = matchKey ? answers[matchKey] : "(no scripted response)";
      return {
        text,
        usage: { inputTokens: 1, outputTokens: 1, costUsd: 0, modelId },
      };
    },
    async *stream() { /* unused */ },
  };
}

Deno.test("eval cases: well-formed responses all pass", async () => {
  // Each key is a unique substring from the corresponding case's user message.
  const answers: Record<string, string> = {
    "Austin, TX, $525k": "MATCH_SCORE: 8/10\nStrong fit on price, beds, and metro.",
    "best crypto":
      "I'm focused on US real estate, not crypto. Want me to look at homes or rentals in your market instead?",
    "waive the inspection":
      "No — waiving inspection on a 1920s craftsman exposes you to material structural risk.\n- Foundation/wiring/plumbing risk in pre-WWII builds\n- Lender may still require an inspection report\n- Better lever: shorten contingency to 3 days",
    "4-unit multifamily in Cleveland":
      "Cleveland 4-unit @ $310k, $4,100/mo gross. Roughly 1.3% rent-to-price, GRM ~6.3. After 50% expense rule NOI ~$24.6k, ~7.9% cap. Taxes light at $4,800. Risks: vacancy, deferred maintenance, neighborhood class. Verify rent roll and CapEx reserves before LOI.",
    "Raleigh, NC": JSON.stringify({
      title: "Raleigh 3bd $400k-$450k comps",
      rows: [
        { addr: "123 Oak St", price: 425000 },
        { addr: "44 Pine Ln", price: 410000 },
      ],
    }),
  };

  const summary = await runEval({ provider: scriptedProvider(answers) });
  if (summary.failed > 0) console.log(formatSummary(summary));
  assertEquals(summary.failed, 0, `expected all cases to pass, got ${summary.failed} failures`);
  assertEquals(summary.passed, EVAL_CASES.length);
  assert(summary.meanScore >= 0.99);
});

Deno.test("eval cases: malformed responses fail their contracts", async () => {
  // Strip MATCH_SCORE prefix → contract violation. Crypto answer → scope violation.
  const answers: Record<string, string> = {
    "Austin, TX, $525k": "Strong fit on price, beds, and metro.", // missing prefix
    "best crypto": "Bitcoin and Ethereum are top picks this week.", // off-topic
    "waive the inspection": "It depends on many factors and personal risk tolerance.", // not decision-first
    "4-unit multifamily in Cleveland": "x".repeat(5000), // over length budget
    "Raleigh, NC": "not json at all", // invalid JSON
  };

  const summary = await runEval({ provider: scriptedProvider(answers) });
  assertEquals(summary.passed, 0, "expected all cases to fail");
  assertEquals(summary.failed, EVAL_CASES.length);
});

Deno.test("filterCases narrows by tag/surface", () => {
  const contract = filterCases({ tag: "contract" });
  assert(contract.length >= 2);
  assert(contract.every((c) => (c.tags ?? []).includes("contract")));

  const onlyBrief = filterCases({ surface: "investor_brief" });
  assert(onlyBrief.every((c) => c.surface === "investor_brief"));
});

Deno.test("runEval reports provider errors as failed cases (not thrown)", async () => {
  const exploding: ChatProvider = {
    async complete() {
      throw new Error("boom");
    },
    async *stream() { /* unused */ },
  };
  const summary = await runEval({
    provider: exploding,
    filter: { id: "extension-match-score-prefix" },
  });
  assertEquals(summary.total, 1);
  assertEquals(summary.failed, 1);
  assertEquals(summary.results[0].errored, true);
  assertEquals(summary.results[0].errorMessage, "boom");
});