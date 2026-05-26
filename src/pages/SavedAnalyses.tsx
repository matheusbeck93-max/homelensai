import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  ExternalLink,
  Loader2,
  Lock,
  MoreVertical,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Navigation } from "@/components/Navigation";
import { ConsoleSidebar } from "@/components/investor/console/ConsoleSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSavedAnalyses, type SavedAnalysis } from "@/hooks/useSavedAnalyses";
import { useSubscription } from "@/hooks/useSubscription";
import { chatMarkdownComponents } from "@/components/chat/markdownComponents";
import { useToast } from "@/hooks/use-toast";

function scoreColor(score: number | null): string {
  if (score == null) return "hsl(var(--muted-foreground))";
  if (score >= 80) return "hsl(var(--chart-2))";
  if (score >= 50) return "hsl(var(--chart-4))";
  return "hsl(var(--destructive))";
}

function ScoreCircle({ score }: { score: number | null }) {
  if (score == null) return null;
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = scoreColor(score);
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 28 28)"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-sm font-bold"
        style={{ color }}
      >
        {score}
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: any }) {
  if (value == null || value === "") return null;
  return (
    <div className="rounded-md border bg-background/60 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium">{String(value)}</div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function AnalysisCard({
  item,
  onView,
  onDelete,
  onUpdateNote,
}: {
  item: SavedAnalysis;
  onView: () => void;
  onDelete: () => void;
  onUpdateNote: (note: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(item.notes ?? "");
  const [savingNote, setSavingNote] = useState(false);

  const km = item.key_metrics ?? {};
  const summary = item.analysis_summary;
  const summaryShort = summary.length > 280 && !expanded
    ? summary.slice(0, 280) + "…"
    : summary;

  const handleNoteBlur = async () => {
    if (note === (item.notes ?? "")) return;
    setSavingNote(true);
    await onUpdateNote(note);
    setSavingNote(false);
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate">
              {item.property_address ||
                item.property_url ||
                "Untitled analysis"}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Badge variant="secondary" className="capitalize">
                {item.source === "extension" ? "Extension" : "App"}
              </Badge>
              <span>Saved on {formatDate(item.created_at)}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setExpanded(true)}>
                Read full summary
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-4">
          <ScoreCircle score={item.investment_score} />
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricChip label="Cap Rate" value={km.capRate} />
            <MetricChip label="Cash-on-Cash" value={km.cashOnCash} />
            <MetricChip label="Net Cash Flow" value={km.netCashFlow} />
            <MetricChip label="DSCR" value={km.dscr} />
          </div>
        </div>

        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
          {summaryShort}
          {summary.length > 280 && (
            <button
              type="button"
              className="ml-2 text-primary hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        <Textarea
          placeholder="Add a personal note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleNoteBlur}
          rows={2}
        />
        {savingNote && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving note...
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={onView}>
            View Full Analysis
          </Button>
          {item.property_url && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={item.property_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Property
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SavedAnalysesContent({ showHeader = true }: { showHeader?: boolean } = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPremium, loading: subLoading } = useSubscription();
  const {
    analyses,
    loading,
    deleteAnalysis,
    updateNote,
  } = useSavedAnalyses();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "score">("newest");
  const [viewing, setViewing] = useState<SavedAnalysis | null>(null);

  const filtered = useMemo(() => {
    let list = analyses;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          (a.property_address ?? "").toLowerCase().includes(q) ||
          (a.property_url ?? "").toLowerCase().includes(q),
      );
    }
    if (sort === "score") {
      list = [...list].sort(
        (a, b) => (b.investment_score ?? -1) - (a.investment_score ?? -1),
      );
    } else {
      list = [...list].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    return list;
  }, [analyses, search, sort]);

  const handleDelete = async (id: string) => {
    try {
      await deleteAnalysis(id);
      toast({ title: "Analysis deleted" });
      if (viewing?.id === id) setViewing(null);
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div>
      {showHeader && (
        <header className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bookmark className="h-7 w-7 text-primary" />
            Saved Analyses
          </h1>
          <p className="text-muted-foreground mt-1">
            Your investment due diligence history
          </p>
        </header>
      )}

        {!subLoading && !isPremium ? (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-10 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  Saved Analyses is a Premium feature
                </h2>
                <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                  Keep track of every property you analyze. Build your
                  investment due diligence history.
                </p>
              </div>
              <Button onClick={() => navigate("/pricing")} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Upgrade to Premium
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
              <div className="text-sm text-muted-foreground">
                {analyses.length} {analyses.length === 1 ? "analysis" : "analyses"} saved
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search address or URL"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 sm:w-64"
                  />
                </div>
                <Select
                  value={sort}
                  onValueChange={(v) => setSort(v as "newest" | "score")}
                >
                  <SelectTrigger className="sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="score">Highest score</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center space-y-4">
                  <Bookmark className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <h2 className="text-lg font-semibold">
                      No saved analyses yet
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      Analyze a property in the chat and save it to build your
                      investment history.
                    </p>
                  </div>
                  <Button onClick={() => navigate("/chats")}>Go to Chat</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filtered.map((item) => (
                  <AnalysisCard
                    key={item.id}
                    item={item}
                    onView={() => setViewing(item)}
                    onDelete={() => handleDelete(item.id)}
                    onUpdateNote={(n) => updateNote(item.id, n)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {viewing && (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-8">
                    {viewing.property_address ||
                      viewing.property_url ||
                      "Saved analysis"}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-4">
                  <ScoreCircle score={viewing.investment_score} />
                  <div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: scoreColor(viewing.investment_score) }}
                    >
                      {viewing.score_label || "Investment Score"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Saved on {formatDate(viewing.created_at)} · {viewing.source}
                    </div>
                  </div>
                </div>
                {viewing.key_metrics && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <MetricChip label="Cap Rate" value={viewing.key_metrics.capRate} />
                    <MetricChip label="Cash-on-Cash" value={viewing.key_metrics.cashOnCash} />
                    <MetricChip label="Monthly Rent" value={viewing.key_metrics.monthlyRent} />
                    <MetricChip label="Net Cash Flow" value={viewing.key_metrics.netCashFlow} />
                    <MetricChip label="Appreciation" value={viewing.key_metrics.appreciationRate} />
                    <MetricChip label="DSCR" value={viewing.key_metrics.dscr} />
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={chatMarkdownComponents}
                  >
                    {viewing.analysis_summary}
                  </ReactMarkdown>
                </div>
                {viewing.notes && (
                  <div className="border-l-2 border-primary/40 pl-3 text-sm">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Your note
                    </div>
                    {viewing.notes}
                  </div>
                )}
                <DialogFooter className="gap-2">
                  {viewing.property_url && (
                    <Button variant="outline" asChild>
                      <a
                        href={viewing.property_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" /> Open Property
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(viewing.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete Analysis
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}

export default function SavedAnalyses() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <div className="flex flex-col lg:flex-row flex-1">
        <ConsoleSidebar />
        <main className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-6 lg:py-8 max-w-5xl">
            <SavedAnalysesContent />
          </div>
        </main>
      </div>
    </div>
  );
}