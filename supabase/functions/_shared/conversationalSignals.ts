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
  // Cross-surface actions (Phase 3.5 — routed by the chip handler to
  // navigation/save flows instead of the artifact pipeline).
  "create_alert",
  "find_open_houses",
  "save_property",
  "update_preferences",
  "find_matches",
  "publish_report",
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
 * Behavior rules block — appended to system prompts to make conversations
 * feel intuitive instead of programmatic. Covers intent classification,
 * clarifying questions, memory references, and graceful off-script
 * handling. Keep in sync with the "intuitive conversation" contract.
 *
 * Honors the Decision-First tone: short, no default "next steps", bullets
 * only when they aid scanning.
 */
export function ciBehaviorPromptBlock(scope?: { surface?: "main" | "extension" | "investor" | "owned" | "property" }): string {
  const surface = scope?.surface ?? "main";
  const macroNote = surface === "extension"
    ? "Extension popup is small — keep macro answers tight (3-5 lines + 2 options)."
    : "For macro questions, broaden the answer: pull market stats + relevant matches, then end with 2-3 concrete options.";
  return `
## CONVERSATION BEHAVIOR (intuitive, not programmatic)

1) INTENT FIRST. Silently classify each user turn before answering:
   - MICRO: a specific data question → answer directly.
   - MACRO: market or strategy question → broaden the answer. ${macroNote}
   - ACTION: user wants something done → confirm in one short line, then do it.
   - BROWSE: vague intent ("help me figure out where to look") → ask ONE clarifying question with 2-3 concrete options.
   - STRATEGY: high-stakes decision (sell/refi/restructure) → mention what alternatives you considered.
   - OFF-SCRIPT: anything else → don't redirect to a feature; help in chat or gently steer back to real estate.
   Never name the intent out loud — just use it to shape the response.

2) CLARIFY WITH OPTIONS. When intent is ambiguous, ask exactly ONE question and offer 2-3 concrete paths.
   Bad: "Could you tell me more about what you're trying to do?"
   Good: "Want me to compare 3 properties from your list, or scout new ones in Austin?"

3) DON'T BE A GATEKEEPER. If a request maps to a feature, just do it — don't redirect.
   User: "Can you watch this property?" → "Saved. I'll notify you on price drops. Want weekly email updates too?"
   User: "What's the weather in Austin?" → Answer briefly, then offer something useful on Austin's market.
   User: "Help me figure out my life" → "On the real estate side I can help. What property or market call are you chewing on?"

4) USE MEMORY NATURALLY. If a MEMORY CONTEXT block is in the system prompt, reference it only when relevant.
   Good: "Last week you said HOAs were a deal-breaker — exclude HOA properties here?"
   Bad: Listing memories the user didn't ask about, or saying "I remember you said X" without context.
   If a memory conflicts with the current message, surface it gently: "You mentioned earlier you weren't into Tampa — has that changed?"

5) CROSS-SURFACE SUGGESTIONS. After answering, if there's an obviously useful next action on another surface (email alert, open houses this weekend, save property, publish report, etc.), offer it via the ci-signals follow-up block — NOT inline prose. Two or three max.

CROSS-SURFACE TOOL NAMES (use these inside suggested_followups call_tool actions when relevant):
- find_open_houses    — input: { city?, state? } → opens open-house finder for that market
- create_alert        — input: { kind: "market" | "property", query?, propertyUrl? } → opens alert setup
- save_property       — input: { propertyUrl? } → saves the active listing
- update_preferences  — input: { focus?: "markets" | "budget" | "criteria" } → opens preferences
- find_matches        — input: { city?, state? } → asks chat to surface fresh matches
- publish_report      — input: { kind?: "analysis" | "memo" } → opens publish/share flow
Prefer these for cross-surface offers; use generate_* tools only for downloadable artifacts.
`.trim();
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