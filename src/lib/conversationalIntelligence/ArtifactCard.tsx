/**
 * Renders a single generated artifact (xlsx/pdf/image) inline in chat.
 * Used by `<ConversationalIntelligence />` when a `call_tool` chip is
 * resolved by the host into a server-generated download.
 */
import { Button } from "@/components/ui/button";
import { Crown, Download, FileSpreadsheet, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { GeneratedArtifact } from "./types";

export interface ArtifactCardProps {
  artifact:
    | GeneratedArtifact
    | { status: "pending"; label: string }
    | { status: "error"; label: string; error: string; capReached?: boolean };
}

function iconFor(kind: string) {
  if (kind.includes("excel") || kind.includes("xlsx")) return FileSpreadsheet;
  if (kind.includes("image") || kind.includes("chart")) return ImageIcon;
  return FileText;
}

export function ArtifactCard({ artifact }: ArtifactCardProps) {
  if ("status" in artifact && artifact.status === "pending") {
    return (
      <div className="rounded-md border bg-card px-3 py-2.5 text-xs flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Generating {artifact.label}…
      </div>
    );
  }
  if ("status" in artifact && artifact.status === "error") {
    if (artifact.capReached) {
      return (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2.5 text-xs flex items-center gap-3">
          <Crown className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium">Daily {artifact.label} limit reached</div>
            <div className="text-muted-foreground">Upgrade to generate more today.</div>
          </div>
          <Button asChild size="sm">
            <Link to="/console?tab=plan">Upgrade</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
        Could not generate {artifact.label}: {artifact.error}
      </div>
    );
  }
  const a = artifact as GeneratedArtifact;
  const Icon = iconFor(a.kind);
  return (
    <div className="rounded-md border bg-card px-3 py-2.5 text-xs flex items-center gap-3">
      <Icon className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{a.filename}</div>
        {a.sizeBytes != null && (
          <div className="text-muted-foreground">
            {(a.sizeBytes / 1024).toFixed(1)} KB · link expires {new Date(a.downloadUrlExpiresAt).toLocaleDateString()}
          </div>
        )}
      </div>
      <Button asChild size="sm" variant="outline">
        <a href={a.downloadUrl} target="_blank" rel="noopener noreferrer">
          <Download className="h-3.5 w-3.5 mr-1" />
          Download
        </a>
      </Button>
    </div>
  );
}