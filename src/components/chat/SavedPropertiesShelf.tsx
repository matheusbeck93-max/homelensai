import { useState } from "react";
import { Bookmark, ChevronDown, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SavedProperty } from "@/hooks/useSavedProperties";

interface SavedPropertiesShelfProps {
  properties: SavedProperty[];
  onDelete: (id: string) => void;
}

/**
 * Collapsible "Saved Properties" shelf — sits at top of the chats sidebar.
 * Each row shows the property address (primary) + city/state (subtle).
 * Click row → open listing URL in new tab. Hover reveals × delete.
 */
export function SavedPropertiesShelf({ properties, onDelete }: SavedPropertiesShelfProps) {
  const [open, setOpen] = useState(true);
  const count = properties.length;

  return (
    <div className="px-3 pt-3">
      <div className="bg-muted/40 rounded-xl border border-border/60 overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-5 h-5 bg-primary/10 text-primary rounded-md">
              <Bookmark className="w-3 h-3 fill-current" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Saved Properties
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/60">
              {count}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                open ? "rotate-180" : "",
              )}
            />
          </div>
        </button>

        {open && (
          <div className="px-2 pb-2 space-y-1">
            {count === 0 ? (
              <div className="px-2 py-3 text-[11px] text-muted-foreground leading-snug">
                Bookmark any listing you analyze in chat — it'll show up here for quick access.
              </div>
            ) : (
              properties.map((p, idx) => (
                <a
                  key={p.id}
                  href={p.property_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-center justify-between p-2 rounded-lg bg-background border border-transparent hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                    <div
                      className={cn(
                        "w-1 h-6 rounded-full transition-colors flex-shrink-0",
                        idx === 0 ? "bg-primary/40 group-hover:bg-primary" : "bg-border group-hover:bg-primary",
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {p.property_address}
                      </span>
                      {(p.city || p.state) && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {[p.city, p.state].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {p.source === 'chrome_extension' && (
                        <span
                          className="mt-0.5 inline-flex w-fit items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary"
                          title="Saved from the Chrome extension"
                        >
                          Extension
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <span className="p-1.5 text-muted-foreground">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(p.id);
                      }}
                      className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove saved property"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}