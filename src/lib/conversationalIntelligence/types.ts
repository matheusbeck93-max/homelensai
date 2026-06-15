/**
 * Shared types for the Conversational Intelligence module.
 *
 * Surfaces (main app `/chats`, Investor chat, Chrome extension, etc.) pass
 * a `ConversationalContext` to the wrapper; the module reads it to render
 * follow-up cards, chips, artifact downloads, and KPI cards uniformly.
 */

export type SurfaceKind =
  | "general_chat" // src/pages/Chats.tsx
  | "investor_chat" // InvestorChat
  | "owned_property" // PropertyChat
  | "deep_dive" // DeepPanel
  | "extension"; // chrome-extension popup

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  /** Tool calls the AI made on this turn, if any. */
  toolCalls?: { name: string; input?: unknown; output?: unknown }[];
  /**
   * Structured signals the AI emitted alongside its text. Phase 2+ uses
   * `mismatch_signals` as the primary trigger for preference-followup
   * cards (preferred over client-side regex/city extraction).
   */
  signals?: {
    mismatch_signals?: MismatchSignal[];
    suggested_followups?: { label: string; action: FollowupAction }[];
    macro_answer?: MacroAnswer;
  };
}

export interface MacroAnswerMetric {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
}

/**
 * Structured macro answer payload emitted by the AI for MACRO intent turns.
 * Rendered by `<MacroAnswerCard />` in place of (or above) the plain prose.
 */
export interface MacroAnswer {
  takeaway: string;
  metrics: MacroAnswerMetric[];
  /** 0-100; renders the bottom progress bar when present. */
  confidence?: number;
  /** Short attribution line shown under the card. */
  source_note?: string;
}

/**
 * AI-returned mismatch signal. The model attaches these to its turn when
 * it detects the user is exploring something outside their saved prefs,
 * which is more robust than client-side regex on the assistant text.
 */
export interface MismatchSignal {
  type:
    | "location"
    | "budget_over"
    | "budget_under"
    | "property_type"
    | "min_beds"
    | "min_baths"
    | "min_sqft"
    | "cap_rate"
    /** Alias emitted by backend shared schema. */
    | "target_cap_rate";
  value: string | number;
  /** Optional natural-language note from the model. */
  note?: string;
}

export type FollowupAction =
  | { type: "send_message"; text: string }
  | { type: "call_tool"; name: string; input?: Record<string, unknown> };

export interface FollowupSuggestion {
  label: string;
  action: FollowupAction;
  /** Internal id for telemetry de-duplication within a turn. */
  id?: string;
}

export interface ActiveContext {
  kind: SurfaceKind;
  /** Owned-property id when kind === "owned_property". */
  propertyId?: string;
  /** Listing URL or external id when in extension/property context. */
  propertyUrl?: string;
  /**
   * Free-form structured snapshot of the thing currently in focus.
   * Shape aligns with `ListingSnapshot` from `./detectMismatches`; kept
   * loosely typed here to avoid a circular import.
   */
  snapshot?: import("./detectMismatches").ListingSnapshot;
}

export interface ConversationalContext {
  active: ActiveContext;
  thread: ChatTurn[];
  /** Subset of user preferences used by the module. */
  preferences?: import("./detectMismatches").Preferences | null;
  /** Caller-supplied action attribution writer. See ConversationalIntelligence.tsx. */
  onActionAttribution?: (entry: ActionAttributionEntry) => void;
  /** Caller-supplied chip action handler — used for both message and tool actions. */
  onChipAction?: (action: FollowupAction, label: string) => void;
}

export interface ActionAttributionEntry {
  /** Visible-in-thread attribution line, e.g. `Pedro clicked "Generate mortgage Excel"`. */
  text: string;
  /** Surface origin of the action. */
  surface: SurfaceKind;
  /** Source action that fired this attribution. */
  source: "chip" | "preference_followup_card" | "artifact_card";
}

/** Future-extending artifact spec (Phase 3 will narrow per-kind). */
export interface ArtifactSpec {
  kind:
    | "mortgage_excel"
    | "purchase_plan_pdf"
    | "property_report_pdf"
    | "chart_image";
  input: Record<string, unknown>;
}

export interface GeneratedArtifact {
  id: string;
  kind: ArtifactSpec["kind"];
  filename: string;
  /** Short signed-URL TTL — Phase 3 enforces ≤7d. */
  downloadUrl: string;
  downloadUrlExpiresAt: string;
  sizeBytes?: number;
  createdAt: string;
}