/**
 * Client-side helpers that turn a `FollowupTopic` click into the message
 * the chat surface needs to send to the AI, plus end-of-cascade detection.
 *
 * The chat wrapper (`ConversationalIntelligence.tsx`) already strips the
 * `[FOLLOWUP_TOPIC:<id>]` marker before forwarding. These helpers are for
 * surfaces that want to build the cascade prompt themselves (e.g. the
 * Chrome extension popup) or that need to clear the active cascade flag
 * once the tool result lands in the thread.
 */

import { endCascade, getActiveCascade } from "./followupDismissals";
import { FOLLOWUP_REGISTRY, getTopic } from "./followupRegistry";
import type { ChatTurn, FollowupTopic } from "./types";

/** Tool names that the backend follow-up registry knows how to dispatch. */
export const FOLLOWUP_TOOL_NAMES = [
  "test_buying_ability",
  "find_fthb_programs",
  "find_local_lenders",
  "compare_properties",
  "research_neighborhood",
] as const;

export type FollowupToolName = (typeof FOLLOWUP_TOOL_NAMES)[number];

/** Topic id → backend tool name (1:1 in v1). */
const TOPIC_TO_TOOL: Record<string, FollowupToolName> = {
  test_buying_ability: "test_buying_ability",
  fthb_programs: "find_fthb_programs",
  lender_info: "find_local_lenders",
  compare_properties: "compare_properties",
  neighborhood_research: "research_neighborhood",
};

export function toolForTopic(topicId: string): FollowupToolName | null {
  return TOPIC_TO_TOOL[topicId] ?? null;
}

/**
 * Build the natural-language message we send to the AI when a chip is
 * clicked. The system prompt's FOLLOW-UP CASCADE section instructs the
 * model to recognize this and ask for missing inputs in one short turn.
 *
 * Marker is included so server-side telemetry (and any future routing)
 * can match the click back to a topic without re-parsing prose.
 */
export function buildCascadeMessage(topic: FollowupTopic | string): string {
  const t = typeof topic === "string" ? getTopic(topic) : topic;
  if (!t) return "";
  return `[FOLLOWUP_TOPIC:${t.id}] ${t.label}`;
}

/**
 * Detect cascade completion: when the most recent assistant turn carries
 * a tool call whose name belongs to the active cascade, we can clear the
 * activeCascade flag so future chips become eligible again.
 */
export function maybeEndCascadeFromTurn(turn: ChatTurn | undefined): boolean {
  if (!turn || turn.role !== "assistant") return false;
  const active = getActiveCascade();
  if (!active) return false;
  const expectedTool = TOPIC_TO_TOOL[active.topicId];
  if (!expectedTool) {
    endCascade();
    return true;
  }
  const called = (turn.toolCalls ?? []).some((tc) => tc?.name === expectedTool);
  if (called) {
    endCascade();
    return true;
  }
  return false;
}

/** Defensive list export — surfaces that need to disable a chip can introspect. */
export const ALL_FOLLOWUP_TOPICS: FollowupTopic[] = FOLLOWUP_REGISTRY;