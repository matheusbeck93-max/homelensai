/**
 * MATCH SCORE CONTRACT (v1) — read this before parsing a score anywhere.
 * =====================================================================
 * Surfaces that produce a Match Score (`ai-chat` listing-analysis branches and
 * `perplexity-chat` URL-analysis mode) now ALWAYS return a structured score
 * object alongside the prose. Clients (Chrome extension, MCP, web app) MUST
 * read the structured field and MUST NOT rely on regex-parsing prose.
 *
 * Response field (top level of the JSON body):
 *
 *   matchScore: {
 *     score:     number   // 0–10, one decimal allowed (e.g. 7.5)
 *     rationale: string   // one sentence, <= 140 chars
 *     source:    "tool" | "text" | "repair"   // how it was produced
 *   } | null
 *
 * When it appears:
 *   - Present whenever the request analyzes a specific US property listing AND
 *     the caller has a completed profile (`onboarding_completed`).
 *   - `null` (or absent) when there is no property under analysis or no profile
 *     to score against. Clients must handle null — never render "0/10".
 *   - Scope stays US-only; non-US listings are declined upstream, not scored.
 *
 * Prose compatibility:
 *   The legacy `MATCH_SCORE: X/10` first line is still emitted for older
 *   extension builds. It is a mirror of `matchScore.score`, not the source of
 *   truth, and may be removed in a future version. New consumers: use
 *   `matchScore`.
 *
 * Investor Console (`investor-chat`) intentionally FORBIDS match-score prefixes
 * and never returns this field.
 */

export interface StructuredMatchScore {
  score: number;
  rationale: string;
  source: "tool" | "text" | "repair";
}

/** OpenAI-style function tool exposed on scoring calls. */
export const MATCH_SCORE_TOOL_NAME = "submit_match_score";

export const MATCH_SCORE_TOOL_PARAMETERS = {
  type: "object",
  properties: {
    score: {
      type: "number",
      minimum: 0,
      maximum: 10,
      description: "Match quality, 0 (poor) to 10 (perfect). Decimals allowed.",
    },
    rationale: {
      type: "string",
      description: "One-sentence justification (max 140 chars).",
    },
  },
  required: ["score", "rationale"],
} as const;

export const MATCH_SCORE_TOOL_DESCRIPTION =
  "Submit the structured 0-10 match score for this property vs. the buyer profile. REQUIRED on every listing analysis. Call this IN ADDITION to writing the prose analysis (do not skip the prose).";

/** Chat-completions shape (`tools: [...]`). */
export const matchScoreToolChatShape = () => [{
  type: "function",
  function: {
    name: MATCH_SCORE_TOOL_NAME,
    description: MATCH_SCORE_TOOL_DESCRIPTION,
    parameters: MATCH_SCORE_TOOL_PARAMETERS,
  },
}];

/** Internal router shape (`tools: [{ name, description, parameters }]`). */
export const matchScoreToolRouterShape = () => [{
  name: MATCH_SCORE_TOOL_NAME,
  description: MATCH_SCORE_TOOL_DESCRIPTION,
  parameters: MATCH_SCORE_TOOL_PARAMETERS,
}];

function clampScore(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

function normalizeRationale(s: unknown): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > 140 ? `${t.slice(0, 137)}...` : t;
}

/** Reads a `submit_match_score` call out of an OpenAI-shaped tool_calls array. */
export function parseMatchScoreToolCalls(
  toolCalls: any[] | undefined | null,
): StructuredMatchScore | null {
  for (const tc of toolCalls ?? []) {
    const name = tc?.function?.name ?? tc?.name;
    if (name !== MATCH_SCORE_TOOL_NAME) continue;
    try {
      const raw = tc?.function?.arguments ?? tc?.arguments ?? "{}";
      const args = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
      if (typeof args?.score === "number" && Number.isFinite(args.score)) {
        return {
          score: clampScore(args.score),
          rationale: normalizeRationale(args.rationale),
          source: "tool",
        };
      }
    } catch (e) {
      console.warn("[matchScore] tool args parse failed", e);
    }
  }
  return null;
}

/** Legacy fallback: pull `MATCH_SCORE: X/10` out of the prose. */
export function parseMatchScoreFromText(
  text: string | null | undefined,
): StructuredMatchScore | null {
  if (!text) return null;
  const m = text.match(/MATCH[_\s]?SCORE\s*[:\-]\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return { score: clampScore(n), rationale: "", source: "text" };
}

/** Ensures the prose still carries the legacy prefix for older clients. */
export function ensureMatchScorePrefix(
  text: string,
  score: StructuredMatchScore | null,
): string {
  if (!score) return text;
  if (parseMatchScoreFromText(text)) return text;
  const head = `MATCH_SCORE: ${score.score}/10`;
  return text ? `${head}\n\n${text}` : `${head}\n\n${score.rationale}`;
}

/**
 * Repair pass: the structured score is REQUIRED, so when the main model skips
 * the tool call we run one cheap forced-tool call that scores the analysis
 * text against the profile block. Returns null only if that also fails — the
 * caller then emits `matchScore: null` rather than a guessed number.
 */
export async function repairMatchScore(opts: {
  apiKey: string;
  profileBlock: string;
  analysisText: string;
  model?: string;
}): Promise<StructuredMatchScore | null> {
  const { apiKey, profileBlock, analysisText } = opts;
  if (!apiKey || !profileBlock) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model ?? "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              `You score how well a single US property matches a buyer profile. Decide first, explain in one sentence. You must call ${MATCH_SCORE_TOOL_NAME}.\n\nBUYER PROFILE:\n${profileBlock}`,
          },
          {
            role: "user",
            content: `PROPERTY ANALYSIS:\n${analysisText.slice(0, 6000)}`,
          },
        ],
        max_tokens: 300,
        tools: matchScoreToolChatShape(),
        tool_choice: "required",
      }),
    });
    if (!res.ok) {
      console.warn("[matchScore] repair call failed", res.status);
      return null;
    }
    const data = await res.json();
    const parsed = parseMatchScoreToolCalls(data?.choices?.[0]?.message?.tool_calls);
    return parsed ? { ...parsed, source: "repair" } : null;
  } catch (e) {
    console.warn("[matchScore] repair call threw", e);
    return null;
  }
}

/** Builds the shared profile block used in prompts and the repair pass. */
export function buildMatchScoreProfileBlock(p: any): string {
  return [
    `- Budget: $${p?.budget_min || 0} - $${p?.budget_max || "unlimited"}`,
    `- Preferred cities: ${p?.preferred_cities?.join(", ") || "any"}`,
    `- Property types: ${p?.property_types?.join(", ") || "any"}`,
    `- Has children: ${p?.has_children ? "Yes" : "No"}`,
    `- Safety priority: ${p?.safety_priority || "medium"}`,
    `- Risk level: ${p?.risk_level || "moderate"}`,
    `- Min bedrooms: ${p?.min_bedrooms || "any"}`,
    `- Min bathrooms: ${p?.min_bathrooms || "any"}`,
    `- Must-have features: ${p?.must_have_features?.join(", ") || "none"}`,
  ].join("\n");
}

/** Prompt block: prose prefix + mandatory tool call, US-only, decision-first. */
export function buildMatchScoreInstructions(profileBlock: string): string {
  return `\n\nMATCH SCORE (REQUIRED):\nYou MUST call the ${MATCH_SCORE_TOOL_NAME} tool with a 0-10 score and a one-sentence rationale for this US property vs. the buyer profile below. Also start your prose with "MATCH_SCORE: X/10" on its own first line, then a blank line, then the analysis (verdict first).\nBUYER PROFILE:\n${profileBlock}\n`;
}
