/**
 * Conversational Intelligence — surface-agnostic chat enhancements.
 * See ConversationalIntelligence.tsx for adoption pattern.
 */
export { ConversationalIntelligence } from "./ConversationalIntelligence";
export type { ConversationalIntelligenceProps } from "./ConversationalIntelligence";
export {
  detectMismatches,
  mismatchFollowupsFromSignals,
  shouldShow,
} from "./detectMismatches";
export type {
  Preferences,
  ListingSnapshot,
  UpdatePayload,
  MismatchFollowup,
  MismatchType,
  MismatchSeverity,
  DismissalRow,
} from "./detectMismatches";
export { suggestFollowups } from "./suggestFollowups";
export { FollowupChipRow } from "./FollowupChipRow";
export { PreferenceFollowupCardWeb } from "./PreferenceFollowupCardWeb";
export { useConversationalIntelligenceState } from "./useConversationalIntelligenceState";
export { ArtifactCard } from "./ArtifactCard";
export { MacroAnswerCard, getMacroAnswer } from "./MacroAnswerCard";
export { trackCiEvent } from "./telemetry";
export type { CiEventName } from "./telemetry";
export type {
  ActionAttributionEntry,
  ActiveContext,
  ArtifactSpec,
  ChatTurn,
  ConversationalContext,
  FollowupAction,
  FollowupSuggestion,
  GeneratedArtifact,
  MacroAnswer,
  MacroAnswerMetric,
  MismatchSignal,
  SurfaceKind,
} from "./types";