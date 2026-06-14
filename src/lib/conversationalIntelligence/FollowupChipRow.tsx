/**
 * Renders a horizontal row of suggested next-step "chips" derived from the
 * last assistant turn (via `suggestFollowups`). Chips are click-to-act:
 *   - `send_message` actions call the host's chat send.
 *   - `call_tool` actions are forwarded to the host's `onChipAction`; in
 *     Phase 2 the host typically translates them to a `send_message` while
 *     the artifact tools are still being built in Phase 3.
 * Per product decision #2, the row only renders when there are >= 2 chips.
 */
import { Button } from "@/components/ui/button";
import type { FollowupAction, FollowupSuggestion } from "./types";

export interface FollowupChipRowProps {
  suggestions: FollowupSuggestion[];
  onAction: (action: FollowupAction, label: string) => void;
}

export function FollowupChipRow({ suggestions, onAction }: FollowupChipRowProps) {
  if (!suggestions || suggestions.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-2">
      {suggestions.map((s) => (
        <Button
          key={s.id ?? s.label}
          size="sm"
          variant="outline"
          className="h-7 text-xs rounded-full"
          onClick={() => onAction(s.action, s.label)}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}