/**
 * Heuristic that maps the last AI turn → 2-3 next-step chips.
 *
 * Phase 1: scaffold + registry only. Phase 2 wires the chip row into
 * `<ConversationalIntelligence />` and the per-surface chat composers.
 * Phase 3 adds artifact-generating actions once those tools exist.
 */

import type { ChatTurn, ConversationalContext, FollowupSuggestion } from "./types";
import { rankFollowups } from "./rankFollowups";

type Mapping = (turn: ChatTurn, ctx: ConversationalContext) => FollowupSuggestion[];

const TOOL_MAPPINGS: Record<string, Mapping> = {
  compute_metrics: () => [
    {
      id: "mortgage_xlsx",
      label: "Generate mortgage Excel",
      // Tool name is a Phase 3 placeholder — kept here so the registry is
      // discoverable. Phase 2 chip renderer ignores call_tool actions whose
      // tool is not yet registered.
      action: { type: "call_tool", name: "generate_mortgage_excel", input: { from_last_metrics: true } },
    },
    {
      id: "compare_saved",
      label: "Compare to my saved properties",
      action: { type: "send_message", text: "Compare this to my saved properties by cap rate." },
    },
  ],
  get_market_stats: () => [
    {
      id: "show_listings",
      label: "Show me listings here",
      action: { type: "send_message", text: "Show me current listings in this market." },
    },
    {
      id: "market_pdf",
      label: "Generate market report PDF",
      action: {
        type: "call_tool",
        name: "generate_property_report_pdf",
        input: { kind: "market", from_last_stats: true },
      },
    },
  ],
};

const FALLBACK: FollowupSuggestion = {
  id: "what_else",
  label: "What else can you help with?",
  action: { type: "send_message", text: "What else can you analyze or build for me about this?" },
};

/**
 * Returns at most 3 suggestions. Per product decision #2 the caller
 * should only render the chip row when this returns ≥2 items.
 */
export function suggestFollowups(
  lastAiTurn: ChatTurn | undefined,
  ctx: ConversationalContext,
): FollowupSuggestion[] {
  if (!lastAiTurn || lastAiTurn.role !== "assistant") return [];

  // Prefer model-provided suggestions when present (Phase 2+).
  const fromModel = lastAiTurn.signals?.suggested_followups;
  if (fromModel?.length) {
    return fromModel.slice(0, 3).map((s, i) => ({ id: `model_${i}`, ...s }));
  }

  // Registry-driven contextual follow-ups (PR A). Each topic's on_accept
  // cascade is launched via send_message — the AI's system prompt knows
  // how to handle "User clicked: ${label}" turns. The chip click handler
  // also calls `markClicked`/`startCascade` for cascade-type topics.
  const registryHits = rankFollowups(ctx, {
    threshold: ctx.active.kind === "extension" ? 0.4 : 0.3,
    max: ctx.active.kind === "extension" ? 2 : 3,
  });
  if (registryHits.length > 0) {
    return registryHits.map((topic) => ({
      id: `topic_${topic.id}`,
      label: topic.label,
      action: {
        type: "send_message" as const,
        // The AI's FOLLOW-UP CASCADE system prompt section interprets this
        // marker and runs the on_accept cascade for the matching topic.
        text: `[FOLLOWUP_TOPIC:${topic.id}] User clicked: ${topic.label}`,
      },
    }));
  }

  const out: FollowupSuggestion[] = [];
  const seen = new Set<string>();
  for (const tc of lastAiTurn.toolCalls ?? []) {
    const mapper = TOOL_MAPPINGS[tc.name];
    if (!mapper) continue;
    for (const s of mapper(lastAiTurn, ctx)) {
      const key = s.id ?? s.label;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      if (out.length >= 3) return out;
    }
  }

  if (out.length > 0 && out.length < 3) out.push(FALLBACK);
  return out.slice(0, 3);
}