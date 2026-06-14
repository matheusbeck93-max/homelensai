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

import { useMemo, useState } from "react";
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
import { ArtifactCard } from "./ArtifactCard";
import type { GeneratedArtifact } from "./types";

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
  /**
   * Phase 3: server-backed artifact generator. When present, `call_tool`
   * chips whose tool name starts with `generate_` are routed here and
   * rendered as <ArtifactCard /> right above the composer.
   */
  onGenerateArtifact?: (
    kind: GeneratedArtifact["kind"],
    input: Record<string, unknown>,
  ) => Promise<
    | { ok: true; artifact: GeneratedArtifact; cap?: { used: number; limit: number; tier: string } }
    | { ok: false; error: string; cap_reached?: boolean }
  >;
  onAcceptFollowup: (f: MismatchFollowup) => Promise<{ ok: boolean; error?: string }>;
  onDismissFollowup: (f: MismatchFollowup) => Promise<{ ok: boolean }>;
  onSaveException: (
    f: MismatchFollowup,
    note: string,
    snapshot?: ListingSnapshot,
    propertyUrl?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Optional listing URL passed to save_exception. */
  propertyUrl?: string;
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
  onGenerateArtifact,
  onAcceptFollowup,
  onDismissFollowup,
  onSaveException,
  propertyUrl,
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

  type CardState =
    | { id: string; status: "pending"; label: string }
    | { id: string; status: "ready"; artifact: GeneratedArtifact }
    | { id: string; status: "error"; label: string; error: string };
  const [cards, setCards] = useState<CardState[]>([]);

  const handleChip = async (action: FollowupAction, label: string) => {
    if (onChipAction) return onChipAction(action, label);
    if (action.type === "send_message") {
      onSendMessage?.(action.text);
      return;
    }
    if (action.type === "call_tool" && action.name.startsWith("generate_")) {
      if (!onGenerateArtifact) return;
      const kindMap: Record<string, GeneratedArtifact["kind"]> = {
        generate_mortgage_excel: "mortgage_excel",
        generate_purchase_plan_pdf: "purchase_plan_pdf",
        generate_property_report_pdf: "property_report_pdf",
        generate_chart_image: "chart_image",
      };
      const kind = kindMap[action.name];
      if (!kind) return;
      const cardId = crypto.randomUUID();
      setCards((cs) => [...cs, { id: cardId, status: "pending", label }]);
      const inputWithCtx = {
        ...(action.input ?? {}),
        surface: active.kind,
        ...(active.snapshot?.city && active.snapshot?.state
          ? { address: `${active.snapshot.city}, ${active.snapshot.state}` }
          : {}),
        ...(active.snapshot?.price ? { home_price: active.snapshot.price } : {}),
      };
      const r = await onGenerateArtifact(kind, inputWithCtx);
      let next: CardState;
      if (r.ok === true) {
        next = { id: cardId, status: "ready", artifact: r.artifact };
      } else {
        next = { id: cardId, status: "error", label, error: (r as { error: string }).error };
      }
      setCards((cs) => cs.map((c) => (c.id === cardId ? next : c)));
    }
  };

  if (followups.length === 0 && chips.length < 2 && cards.length === 0) return null;

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
              onSaveException={(ff, note) =>
                onSaveException(ff, note, active.snapshot, propertyUrl ?? active.propertyUrl)
              }
              onChatPrompt={onSendMessage}
            />
          ))}
        </div>
      )}
      <FollowupChipRow suggestions={chips} onAction={handleChip} />
      {cards.length > 0 && (
        <div className="space-y-1.5 px-1">
          {cards.map((c) =>
            c.status === "ready" ? (
              <ArtifactCard key={c.id} artifact={c.artifact} />
            ) : c.status === "pending" ? (
              <ArtifactCard key={c.id} artifact={{ status: "pending", label: c.label }} />
            ) : (
              <ArtifactCard key={c.id} artifact={{ status: "error", label: c.label, error: c.error }} />
            ),
          )}
        </div>
      )}
    </div>
  );
}