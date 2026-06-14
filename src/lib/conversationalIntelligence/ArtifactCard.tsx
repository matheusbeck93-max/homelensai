/**
 * Renders a single generated artifact (xlsx/pdf/image) inline in chat.
 * Used by `<ConversationalIntelligence />` when a `call_tool` chip is
 * resolved by the host into a server-generated download.
 */
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import type { GeneratedArtifact } from "./types";

export interface ArtifactCardProps {
  artifact: GeneratedArtifact | { status: "pending"; label: string } | { status: "error"; label: string; error: string };
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