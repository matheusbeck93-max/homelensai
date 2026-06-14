import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2, Image as ImageIcon, FileSpreadsheet, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ArtifactRow {
  id: string;
  kind: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number | null;
  status: string;
  created_at: string;
}

const KIND_META: Record<string, { label: string; Icon: typeof FileText }> = {
  mortgage_excel: { label: "Mortgage workbook", Icon: FileSpreadsheet },
  purchase_plan_pdf: { label: "Purchase plan", Icon: FileText },
  property_report_pdf: { label: "Property report", Icon: FileText },
  chart_image: { label: "Chart", Icon: BarChart3 },
};

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function SavedArtifactsPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ArtifactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("artifacts")
        .select("id, kind, filename, storage_path, mime_type, size_bytes, status, created_at")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setRows((data ?? []) as ArtifactRow[]);
    } catch (err) {
      console.error("Error loading artifacts:", err);
      toast({ title: "Failed to load artifacts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (row: ArtifactRow) => {
    setDownloading(row.id);
    try {
      const { data, error } = await supabase.storage
        .from("artifacts")
        .createSignedUrl(row.storage_path, 60 * 5);
      if (error || !data?.signedUrl) throw error ?? new Error("no_signed_url");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = row.filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Download failed:", err);
      toast({ title: "Download failed", description: "The file may have been removed.", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (row: ArtifactRow) => {
    if (!confirm(`Delete ${row.filename}?`)) return;
    try {
      await supabase.storage.from("artifacts").remove([row.storage_path]);
      const { error } = await supabase.from("artifacts").delete().eq("id", row.id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast({ title: "Artifact deleted" });
    } catch (err) {
      console.error("Delete failed:", err);
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Saved artifacts
          </CardTitle>
          <CardDescription>
            Reports, workbooks, and charts you generate from chat will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No artifacts yet. Generate a purchase plan, mortgage workbook, or property report from any chat.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Saved artifacts
        </CardTitle>
        <CardDescription>
          {rows.length} {rows.length === 1 ? "file" : "files"} — PDFs, workbooks, and charts generated from your chats.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => {
          const meta = KIND_META[row.kind] ?? { label: row.kind, Icon: ImageIcon };
          const Icon = meta.Icon;
          return (
            <div
              key={row.id}
              className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-accent/40 transition-colors"
            >
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{row.filename}</div>
                <div className="text-xs text-muted-foreground">
                  {meta.label} · {formatBytes(row.size_bytes)} · {format(new Date(row.created_at), "MMM d, yyyy")}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(row)}
                disabled={downloading === row.id}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(row)}
                className="text-destructive hover:text-destructive"
                aria-label="Delete artifact"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}