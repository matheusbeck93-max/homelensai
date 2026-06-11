import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSavedProperties, type SavedProperty } from "@/hooks/useSavedProperties";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bookmark, ExternalLink, Trash2 } from "lucide-react";

/**
 * Console "Properties" tab — reads the same `saved_properties` table that
 * powers the /chats sidebar shelf and the Chrome extension Save Property
 * flow. One source of truth, multiple surfaces.
 */
export function SavedPropertiesPanel() {
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id });
    });
  }, []);

  const { properties, loading, deleteProperty } = useSavedProperties(user);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" />
          Saved Properties
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Everything you've saved — from the app, the Chrome extension, or by pasting a listing URL in chat.
        </p>
      </CardHeader>
      <CardContent>
        {loading && properties.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : properties.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No saved properties yet. Save a listing from the app or the Chrome extension and it'll show up here.
          </p>
        ) : (
          <div className="space-y-2">
            {properties.map((p) => (
              <PropertyRow key={p.id} property={p} onDelete={() => deleteProperty(p.id)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PropertyRow({ property: p, onDelete }: { property: SavedProperty; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt=""
            loading="lazy"
            className="w-14 h-14 rounded-md object-cover flex-shrink-0 bg-muted"
          />
        ) : (
          <div className="w-14 h-14 rounded-md bg-muted flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">
              {p.property_address}
            </span>
            {p.source === "chrome_extension" && (
              <span
                className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                title="Saved from the Chrome extension"
              >
                Chrome extension
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {[p.city, p.state].filter(Boolean).join(", ")}
            {p.price ? ` · $${p.price.toLocaleString()}` : ""}
            {p.beds ? ` · ${p.beds} bd` : ""}
            {p.baths ? ` · ${p.baths} ba` : ""}
            {p.sqft ? ` · ${p.sqft.toLocaleString()} sqft` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button asChild variant="ghost" size="sm">
          <a href={p.property_url} target="_blank" rel="noopener noreferrer" aria-label="Open listing">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Remove saved property"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}