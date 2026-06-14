/**
 * Thin re-export wrapper — the canonical implementation lives at
 * `src/lib/conversationalIntelligence/detectMismatches.ts` so the web
 * surface (`<ConversationalIntelligence />`) and the Chrome extension
 * popup share one source of truth. Do not fork.
 *
 * Severity order: blocker → major → minor. The popup still caps the
 * list to 2 at the call site.
 */
export {
  detectMismatches,
  shouldShow,
  type MismatchSeverity,
  type MismatchType,
  type Preferences,
  type ListingSnapshot,
  type UpdatePayload,
  type MismatchFollowup,
  type DismissalRow,
} from '../../src/lib/conversationalIntelligence/detectMismatches';
