/**
 * Golden-set cases for the HomeLens AI eval harness.
 *
 * Cases are intentionally small and behavior-focused: they assert contracts
 * the product depends on (MATCH_SCORE prefix, US real-estate scope, JSON
 * shape, length budgets) — NOT factual recall, which is too brittle to gate
 * on across model upgrades.
 */

import type { SurfaceId } from "../surfaceConfig.ts";
import type { ChatRequest, Tier } from "../types.ts";
import {
  all,
  containsAll,
  hasMatchScorePrefix,
  isValidJson,
  jsonHasKeys,
  matches,
  maxLength,
  refusesTerms,
  type Scorer,
} from "./scorers.ts";

export interface EvalCase {
  id: string;
  surface: SurfaceId;
  tier: Tier;
  description: string;
  request: ChatRequest;
  scorer: Scorer;
  /** Minimum score (0..1) to consider this case passing. Defaults to 1. */
  threshold?: number;
  /** Tags for filtering — e.g. "smoke", "contract", "scope". */
  tags?: string[];
}

export const EVAL_CASES: EvalCase[] = [
  // --- MATCH_SCORE contract (extension + structured listing analysis) ---
  {
    id: "extension-match-score-prefix",
    surface: "extension_listing_analysis",
    tier: "buyer",
    description: "Listing analysis must prefix MATCH_SCORE: X/10.",
    request: {
      system:
        "You are HomeLens. Always begin your response with `MATCH_SCORE: X/10` (X=0..10) on its own first line.",
      messages: [
        {
          role: "user",
          content:
            "Analyze this property: 3bd/2ba in Austin, TX, $525k, built 2014, 1,840 sqft. Buyer wants <$550k, 3bd, Austin metro.",
        },
      ],
    },
    scorer: hasMatchScorePrefix(),
    tags: ["contract", "smoke"],
  },

  // --- US real-estate scope rule ---
  {
    id: "scope-redirects-off-topic",
    surface: "general_chat",
    tier: "free",
    description: "Off-topic questions are warmly redirected to US real estate.",
    request: {
      system:
        "You are HomeLens, a US real estate assistant. For anything not real-estate related, warmly redirect the user back to real estate. Do NOT answer crypto, sports, or general trivia.",
      messages: [{ role: "user", content: "What's the best crypto to buy this week?" }],
    },
    scorer: all([
      refusesTerms(["bitcoin", "ethereum", "altcoin"]),
      containsAll(["real estate"]),
    ]),
    tags: ["scope"],
  },

  // --- Decision-first tone ---
  {
    id: "tone-decision-first-yes-no",
    surface: "general_chat",
    tier: "investor",
    description: "Decision-style questions open with a yes/no/likely conclusion.",
    request: {
      system:
        "You are HomeLens. For decision-based questions, open with a clear Yes / No / Likely conclusion on the first line, then 3 short supporting bullets.",
      messages: [
        {
          role: "user",
          content:
            "Should I waive the inspection contingency on a $700k 1920s craftsman in Seattle to win a bidding war?",
        },
      ],
    },
    scorer: matches(/^\s*(yes|no|likely|unlikely)\b/i),
    tags: ["tone"],
  },

  // --- Length budget for the brief surface ---
  {
    id: "brief-length-budget",
    surface: "investor_brief",
    tier: "investor",
    description: "Investor brief stays under ~1200 chars.",
    request: {
      system: "You are HomeLens. Produce a tight investor brief. Hard cap: 1200 characters total.",
      messages: [
        {
          role: "user",
          content:
            "Brief me on a 4-unit multifamily in Cleveland, OH listed at $310k, gross rents $4,100/mo, taxes $4,800/yr.",
        },
      ],
    },
    scorer: maxLength(1400), // soft buffer over the prompt cap
    threshold: 0.85,
    tags: ["budget"],
  },

  // --- JSON output contract (artifact generation) ---
  {
    id: "artifact-json-shape",
    surface: "artifact_generation",
    tier: "investor",
    description: "Artifact generation returns parseable JSON with required keys.",
    request: {
      responseFormat: "json",
      system:
        'Return ONLY a JSON object with keys: "title" (string), "rows" (array). No prose, no code fences.',
      messages: [
        {
          role: "user",
          content: "Produce a 5-row comparison of $400k-$450k 3bd homes in Raleigh, NC.",
        },
      ],
    },
    scorer: all([isValidJson(), jsonHasKeys(["title", "rows"])]),
    tags: ["contract"],
  },
];

export function filterCases(opts: {
  surface?: SurfaceId;
  tier?: Tier;
  tag?: string;
  id?: string;
}): EvalCase[] {
  return EVAL_CASES.filter((c) => {
    if (opts.surface && c.surface !== opts.surface) return false;
    if (opts.tier && c.tier !== opts.tier) return false;
    if (opts.tag && !(c.tags ?? []).includes(opts.tag)) return false;
    if (opts.id && c.id !== opts.id) return false;
    return true;
  });
}