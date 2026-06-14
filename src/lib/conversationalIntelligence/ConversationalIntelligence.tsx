/**
 * Surface-agnostic wrapper that renders Conversational Intelligence UI
 * (preference follow-up cards, smart follow-up chips, artifact downloads,
 * KPI cards) alongside any chat surface in HomeLens.
 *
 * Phase 1: scaffolded as a no-op render that simply accepts and validates
 * its context. Phase 2 wires the preference-followup card + chip row.
 * Phase 3 wires the artifact and KPI cards.
 *
 * Adoption pattern (all surfaces, ~3 lines):
 *
 *   <ConversationalIntelligence
 *     active={{ kind: "general_chat" }}
 *     thread={messages}
 *     preferences={prefs}
 *     onChipAction={handleChipAction}
 *   />
 */

import { useMemo } from "react";
import type { ChatTurn, ConversationalContext, FollowupAction, SurfaceKind } from "./types";
import type { Preferences } from "./detectMismatches";

export interface ConversationalIntelligenceProps {
  active: { kind: SurfaceKind; propertyId?: string; propertyUrl?: string; snapshot?: Record<string, unknown> };
  thread: ChatTurn[];
  preferences?: Preferences | null;
  onChipAction?: (action: FollowupAction, label: string) => void;
  onActionAttribution?: ConversationalContext["onActionAttribution"];
}

export function ConversationalIntelligence(_props: ConversationalIntelligenceProps) {
  // Phase 1 placeholder: validates props via TS and returns nothing visible.
  // Each surface can adopt the wrapper now; Phase 2 turns on rendering.
  const _ctx = useMemo<ConversationalContext>(
    () => ({
      active: _props.active,
      thread: _props.thread,
      preferences: _props.preferences ?? null,
      onActionAttribution: _props.onActionAttribution,
      onChipAction: _props.onChipAction,
    }),
    [_props.active, _props.thread, _props.preferences, _props.onActionAttribution, _props.onChipAction],
  );
  return null;
}