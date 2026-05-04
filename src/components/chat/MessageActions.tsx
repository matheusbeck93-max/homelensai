import React, { useState, useRef } from "react";
import { Copy, Pencil, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MessageActionsProps {
  /** The text to copy / edit. */
  text: string;
  /** Called when the user taps Edit — parent should populate the input and remove the message. */
  onEdit: () => void;
  /** Position the action cluster on the left or right of the bubble. Defaults to "right". */
  side?: "left" | "right";
  className?: string;
}

const LONG_PRESS_MS = 450;

/**
 * Hover/long-press action cluster for chat messages.
 * Desktop: fades in on hover. Mobile: revealed via long-press.
 */
export function MessageActions({ text, onEdit, side = "right", className }: MessageActionsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Could not copy",
        description: "Clipboard access was denied.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMobileVisible(false);
    onEdit();
  };

  const startLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setMobileVisible(true);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div
      className={cn("relative group/msg inline-flex", className)}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchCancel={cancelLongPress}
    >
      {/* Wrap children via render through CSS only; this component is rendered as a sibling overlay */}
      <div
        className={cn(
          "absolute -top-3 flex items-center gap-1 rounded-full border bg-background/95 backdrop-blur px-1 py-0.5 shadow-sm",
          "transition-opacity duration-150",
          side === "right" ? "right-0" : "left-0",
          mobileVisible
            ? "opacity-100"
            : "opacity-0 group-hover/bubble:opacity-100 focus-within:opacity-100",
          // Always interactive, even when invisible-on-hover so keyboard users can reach it
          "pointer-events-auto"
        )}
        role="toolbar"
        aria-label="Message actions"
      >
        <button
          type="button"
          onClick={handleCopy}
          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title={copied ? "Copied" : "Copy"}
          aria-label={copied ? "Copied" : "Copy message"}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleEdit}
          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Edit"
          aria-label="Edit message"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}