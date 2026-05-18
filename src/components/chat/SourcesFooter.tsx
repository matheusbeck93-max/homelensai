import React, { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

interface SourcesFooterProps {
  citations: string[];
}

/**
 * 2.5C — Collapsed "Sources" footer for grounded (Perplexity) responses.
 *
 * Preserves the conversational tone in the answer body and lets the user
 * verify with one click. Renders outside the markdown text so the TTS
 * sanitizer (which reads `message.content`) cleanly skips it.
 */
export function SourcesFooter({ citations }: SourcesFooterProps) {
  const [open, setOpen] = useState(false);

  const unique = Array.from(
    new Set(
      citations
        .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
    )
  );

  if (unique.length === 0) return null;

  return (
    <div className="mt-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>Sources ({unique.length})</span>
      </button>
      {open && (
        <ol className="mt-1.5 ml-4 space-y-1 list-decimal text-muted-foreground">
          {unique.map((url, i) => {
            let host = url;
            try {
              host = new URL(url).hostname.replace(/^www\./, "");
            } catch {
              /* keep raw url */
            }
            return (
              <li key={i} className="break-all">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {host}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}