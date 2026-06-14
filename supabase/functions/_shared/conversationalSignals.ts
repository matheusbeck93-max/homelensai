/**
 * Conversational Intelligence signals (Phase 3 Workstream A).
 *
 * Shared contract for chat backends to emit structured `mismatch_signals`
 * and `suggested_followups` alongside their normal assistant text. The
 * model appends a fenced ` ```ci-signals ` JSON block at the end of its
 * response; `extractCiSignals` strips it from the user-visible text and
 * returns the parsed payload (or empty when the model omits it).
 *
 * The web `<ConversationalIntelligence />` component prefers these over
 * client-side regex/heuristics — keep the schema in sync with
 * `src/lib/conversationalIntelligence/types.ts`.
 */

export const CI_SIGNALS_TYPES = [
  "location",
  "budget_over",
  "budget_under",
  "property_type",
  "min_beds",
  "min_baths",
  "min_sqft",
  "target_cap_rate",
] as const;

export const CI_SIGNALS_TOOLS = [
  "generate_mortgage_excel",
  "generate_purchase_plan_pdf",
  "generate_property_report_pdf",
  "generate_chart_image",
] as const;

export interface MismatchSignal {
  type: (typeof CI_SIGNALS_TYPES)[number];
  severity?: "blocker" | "major" | "minor";
  detected_value?: unknown;
  preferred_value?: unknown;
  value?: string | number;
  note?: string;
}

export type FollowupAction =
  | { type: "send_message"; text: string }
  | { type: "call_tool"; name: string; input?: Record<string, unknown> };

export interface SuggestedFollowup {
  label: string;
  action: FollowupAction;
}

export interface CiSignals {
  mismatch_signals: MismatchSignal[];
  suggested_followups: SuggestedFollowup[];
}

/**
 * Prompt block that instructs the model how to emit the structured
 * signals. Append at the END of the system prompt so it does not
 * interfere with answer-first / match-score contracts.
 *
 * `scope` lets a caller disable signals that don't make sense for a
 * given surface — e.g. owned-property-chat has no `location` mismatch.
 */
export function ciSignalsPromptBlock(scope?: {
  allowedMismatchTypes?: ReadonlyArray<(typeof CI_SIGNALS_TYPES)[number]>;
  allowedTools?: ReadonlyArray<(typeof CI_SIGNALS_TOOLS)[number]>;
}): string {
  const types = scope?.allowedMismatchTypes ?? CI_SIGNALS_TYPES;
  const tools = scope?.allowedTools ?? CI_SIGNALS_TOOLS;
  return `
## STRUCTURED FOLLOW-UP SIGNALS (machine-readable, optional)

If — and only if — your answer references a property or scenario that
is meaningfully different from the user's saved preferences, OR there
is a clear, useful next action the user might want, append a single
fenced block at the very END of your reply (after all prose, tables,
links) in this EXACT shape:

\`\`\`ci-signals
{
  "mismatch_signals": [
    { "type": "<one of: ${types.join(" | ")}>",
      "severity": "blocker" | "major" | "minor",
      "detected_value": <number|string>,
      "preferred_value": <number|string> }
  ],
  "suggested_followups": [
    { "label": "<<=28 chars>",
      "action": { "type": "send_message", "text": "<one short question>" } }
    /* or */
    { "label": "<<=28 chars>",
      "action": { "type": "call_tool",
                  "name": "<one of: ${tools.join(" | ")}>",
                  "input": { /* tool-specific, optional */ } } }
  ]
}
\`\`\`

Rules:
- Up to 2 mismatch_signals and up to 3 suggested_followups.
- Omit the entire block if neither applies — never emit an empty block.
- Output STRICTLY valid JSON inside the fence. No trailing commas, no
  comments, no markdown.
- The block is invisible to the user; do not reference it in prose.
`.trim();
}

/**
 * Strip the trailing ci-signals fence (if any) from assistant text and
 * return both the cleaned text and the parsed signals. Resilient to
 * minor model formatting drift (extra whitespace, missing language hint).
 */
export function extractCiSignals(text: string): {
  cleanText: string;
  signals: CiSignals | null;
} {
  if (!text) return { cleanText: text, signals: null };
  // Match the LAST ```ci-signals … ``` block in the response.
  const re = /```(?:ci[-_]signals|json)?\s*\n?(\{[\s\S]*?\})\s*\n?```\s*$/i;
  const m = text.trimEnd().match(re);
  if (!m) return { cleanText: text, signals: null };
  // Require the block to actually mention one of the signal keys to
  // avoid swallowing unrelated trailing JSON / code blocks.
  if (!/mismatch_signals|suggested_followups/.test(m[1])) {
    return { cleanText: text, signals: null };
  }
  let parsed: CiSignals | null = null;
  try {
    const raw = JSON.parse(m[1]);
    const out: CiSignals = {
      mismatch_signals: Array.isArray(raw.mismatch_signals)
        ? raw.mismatch_signals
            .filter(
              (s: unknown): s is MismatchSignal =>
                !!s &&
                typeof s === "object" &&
                typeof (s as MismatchSignal).type === "string" &&
                (CI_SIGNALS_TYPES as readonly string[]).includes(
                  (s as MismatchSignal).type,
                ),
            )
            .slice(0, 2)
        : [],
      suggested_followups: Array.isArray(raw.suggested_followups)
        ? raw.suggested_followups
            .filter((f: unknown): f is SuggestedFollowup => {
              if (!f || typeof f !== "object") return false;
              const ff = f as SuggestedFollowup;
              if (typeof ff.label !== "string" || ff.label.length > 60) return false;
              const a = ff.action;
              if (!a || typeof a !== "object") return false;
              if (a.type === "send_message") return typeof a.text === "string";
              if (a.type === "call_tool")
                return typeof a.name === "string" &&
                  (CI_SIGNALS_TOOLS as readonly string[]).includes(a.name);
              return false;
            })
            .slice(0, 3)
        : [],
    };
    if (out.mismatch_signals.length || out.suggested_followups.length) parsed = out;
  } catch {
    parsed = null;
  }
  const cleanText = text.replace(re, "").trimEnd();
  return { cleanText, signals: parsed };
}