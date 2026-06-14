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
import type { ChatTurn, FollowupAction, MismatchSignal, SurfaceKind } from "./types";
import {
  detectMismatches,
  mismatchFollowupsFromSignals,
  shouldShow,
  type DismissalRow,
  type ListingSnapshot,
  type MismatchFollowup,
  type Preferences,
} from "./detectMismatches";
import { suggestFollowups } from "./suggestFollowups";
import { FollowupChipRow } from "./FollowupChipRow";
import { PreferenceFollowupCardWeb } from "./PreferenceFollowupCardWeb";

export interface ConversationalIntelligenceProps {
  active: {
    kind: SurfaceKind;
    propertyId?: string;
    propertyUrl?: string;
    snapshot?: ListingSnapshot;
  };
  thread: ChatTurn[];
  preferences?: Preferences | null;
  dismissals?: DismissalRow[];
  enabled?: boolean;
  /** Sends a plain user message to the host chat. */
  onSendMessage?: (text: string) => void;
  /** Optional tool-action handler (Phase 3). Falls back to onSendMessage. */
  onChipAction?: (action: FollowupAction, label: string) => void;
  onAcceptFollowup: (f: MismatchFollowup) => Promise<{ ok: boolean; error?: string }>;
  onDismissFollowup: (f: MismatchFollowup) => Promise<{ ok: boolean }>;
  onSaveException: (
    f: MismatchFollowup,
    note: string,
    snapshot?: ListingSnapshot,
  ) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Universal Conversational Intelligence renderer.
 *
 * Renders, above any chat composer:
 *   1. Preference-followup cards for mismatches detected on the last
 *      analyzed listing — AI-returned `mismatch_signals` are preferred;
 *      falls back to client-side `detectMismatches(snapshot, prefs)`.
 *      Capped to 2 per turn and gated by `shouldShow` anti-nagging.
 *   2. A row of next-step chips derived from the last assistant turn
 *      (`suggestFollowups`). Only renders when there are >= 2 chips.
 */
export function ConversationalIntelligence({
  active,
  thread,
  preferences,
  dismissals = [],
  enabled = true,
  onSendMessage,
  onChipAction,
  onAcceptFollowup,
  onDismissFollowup,
  onSaveException,
}: ConversationalIntelligenceProps) {
  const lastAssistant = useMemo(
    () => [...thread].reverse().find((t) => t.role === "assistant"),
    [thread],
  );

  const signals: MismatchSignal[] = lastAssistant?.signals?.mismatch_signals ?? [];

  const followups: MismatchFollowup[] = useMemo(() => {
    if (!enabled || !preferences) return [];
    let fs: MismatchFollowup[] = [];
    if (signals.length > 0) {
      fs = mismatchFollowupsFromSignals(signals, preferences);
    } else if (active.snapshot) {
      fs = detectMismatches(active.snapshot, preferences);
    }
    return fs.filter((f) => shouldShow(f.type, dismissals)).slice(0, 2);
  }, [enabled, preferences, signals, active.snapshot, dismissals]);

  const chips = useMemo(
    () =>
      suggestFollowups(lastAssistant, {
        active,
        thread,
        preferences: preferences ?? null,
      }),
    [lastAssistant, active, thread, preferences],
  );

  const handleChip = (action: FollowupAction, label: string) => {
    if (onChipAction) return onChipAction(action, label);
    if (action.type === "send_message" && onSendMessage) onSendMessage(action.text);
    // call_tool with no host handler: silently ignore until Phase 3.
  };

  if (followups.length === 0 && chips.length < 2) return null;

  return (
    <div className="space-y-2">
      {followups.length > 0 && (
        <div className="space-y-1.5 px-1">
          {followups.map((f) => (
            <PreferenceFollowupCardWeb
              key={f.type}
              followup={f}
              onAccept={onAcceptFollowup}
              onDismiss={onDismissFollowup}
              onSaveException={(ff, note) => onSaveException(ff, note, active.snapshot)}
              onChatPrompt={onSendMessage}
            />
          ))}
        </div>
      )}
      <FollowupChipRow suggestions={chips} onAction={handleChip} />
    </div>
  );
}