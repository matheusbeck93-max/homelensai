/**
 * Web (shadcn) variant of the extension's PreferenceFollowupCard.
 * Visual + behavioral parity with chrome-extension/components/PreferenceFollowupCard.tsx,
 * styled with the app's semantic tokens so it fits any chat surface.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { MismatchFollowup } from "./detectMismatches";

type State =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; text: string }
  | { kind: "dismissed" }
  | { kind: "exception_form" }
  | { kind: "error"; text: string };

export interface PreferenceFollowupCardWebProps {
  followup: MismatchFollowup;
  onAccept: (f: MismatchFollowup) => Promise<{ ok: boolean; error?: string }>;
  onDismiss: (f: MismatchFollowup) => Promise<{ ok: boolean }>;
  onSaveException: (f: MismatchFollowup, note: string) => Promise<{ ok: boolean; error?: string }>;
  onChatPrompt?: (text: string) => void;
}

export function PreferenceFollowupCardWeb({
  followup,
  onAccept,
  onDismiss,
  onSaveException,
  onChatPrompt,
}: PreferenceFollowupCardWebProps) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [note, setNote] = useState("");

  if (state.kind === "dismissed") return null;

  if (state.kind === "saved") {
    return (
      <div className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-300">
        ✓ {state.text}
      </div>
    );
  }

  const informational = followup.update_payload === null;

  const handleAccept = async () => {
    setState({ kind: "saving" });
    const r = await onAccept(followup);
    setState(
      r.ok
        ? { kind: "saved", text: followup.confirmation || "Updated" }
        : { kind: "error", text: r.error || "Could not save" },
    );
  };

  const handleDismiss = async () => {
    setState({ kind: "dismissed" });
    onDismiss(followup);
  };

  const handleSubmitException = async () => {
    setState({ kind: "saving" });
    const r = await onSaveException(followup, note.trim());
    setState(
      r.ok
        ? { kind: "saved", text: "Saved to your Exceptions list" }
        : { kind: "error", text: r.error || "Could not save" },
    );
  };

  const handleTellMeMore = () => {
    if (followup.chat_prompt && onChatPrompt) onChatPrompt(followup.chat_prompt);
    setState({ kind: "dismissed" });
  };

  return (
    <div className="rounded-md border bg-card px-3 py-2.5 text-xs space-y-2">
      <div className="font-semibold text-foreground">{followup.prompt}</div>
      {followup.detail && <div className="text-muted-foreground">{followup.detail}</div>}

      {state.kind === "exception_form" ? (
        <div className="flex flex-col gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            autoFocus
            placeholder="Why is this one interesting? (optional)"
            className="h-8 text-xs"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setState({ kind: "idle" })}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmitException}>
              Save
            </Button>
          </div>
        </div>
      ) : state.kind === "saving" ? (
        <div className="text-muted-foreground">Saving…</div>
      ) : informational ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={handleTellMeMore}>
            Tell me more
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Not really
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap items-center">
          <Button size="sm" onClick={handleAccept}>
            Update preferences
          </Button>
          <Button size="sm" variant="outline" onClick={() => setState({ kind: "exception_form" })}>
            Save as exception
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 ml-auto"
            aria-label="Dismiss"
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {state.kind === "error" && (
        <div className="text-destructive">{state.text}</div>
      )}
    </div>
  );
}