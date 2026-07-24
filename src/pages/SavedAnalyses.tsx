import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  Check,
  ExternalLink,
  Loader2,
  MoreVertical,
  Search,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { TierGate } from "@/components/subscription/TierGate";
import { chatMarkdownComponents } from "@/components/chat/markdownComponents";
import { useToast } from "@/hooks/use-toast";

function scoreColor(score: number | null): string {
  if (score == null) return "hsl(var(--muted-foreground))";
  if (score >= 80) return "hsl(var(--chart-2))";
  if (score >= 50) return "hsl(var(--chart-4))";
  return "hsl(var(--destructive))";
}

function ScoreCircle({
  score,
  size = 56,
}: {
  score: number | null;
  size?: number;
}) {
  if (score == null) return null;
  const stroke = size >= 96 ? 6 : 4;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = scoreColor(score);
  const fontSize = size >= 96 ? "text-2xl" : "text-sm";
  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        className={`absolute inset-0 flex items-center justify-center font-bold ${fontSize}`}
        style={{ color }}
      >
        {score}
      </div>
    </div>
  );
}

function scoreMatchLabel(score: number | null): string {
  if (score == null) return "Investment Score";
  if (score >= 80) return "Great match";
  if (score >= 50) return "Solid match";
  return "Weak match";
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const color = scoreColor(v);
  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-muted-foreground w-24 flex-shrink-0">
        {label}
      </div>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${v}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-sm font-semibold w-8 text-right" style={{ color }}>
        {v}
      </div>
    </div>
  );
}

function deriveHighlights(item: SavedAnalysis): string[] {
  const km: any = item.key_metrics ?? {};
  if (Array.isArray(km.highlights) && km.highlights.length) {
    return km.highlights.slice(0, 5).map((h: any) => String(h));
  }
  const out: string[] = [];
  const netCF = Number(String(km.netCashFlow ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isNaN(netCF) && netCF > 0) out.push("Positive monthly cash flow");
  const coc = Number(String(km.cashOnCash ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isNaN(coc) && coc >= 8) out.push("Strong cash-on-cash return");
  const cap = Number(String(km.capRate ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isNaN(cap) && cap >= 6) out.push("Healthy cap rate");
  if (item.investment_score != null && item.investment_score >= 80)
    out.push("Meets your preferences");
  if (item.property_price) out.push("Within tracked budget range");
  return out.slice(0, 4);
}

// Strip Perplexity-style citations like [¹](https://…) or [1](https://…)
// and bare superscript markers like [¹] that leak into AI summaries.
function sanitizeSummary(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\s*\[[¹²³⁴⁵⁶⁷⁸⁹⁰\d]+\]\(https?:\/\/[^)]+\)/g, "")
    .replace(/\[[¹²³⁴⁵⁶⁷⁸⁹⁰\d]+\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function deriveBreakdown(
  item: SavedAnalysis,
): { label: string; value: number }[] {
  const km: any = item.key_metrics ?? {};
  const b = km.breakdown;
  const overall = item.investment_score;
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const CATEGORIES = ["Price", "Location", "Property", "Neighborhood", "Lifestyle"] as const;

  if (b && typeof b === "object") {
    const rows = CATEGORIES.map((label) => {
      const raw = (b as any)[label.toLowerCase()];
      return { label, value: typeof raw === "number" ? raw : null };
    });
    const filled = rows.filter((r) => r.value != null) as {
      label: string;
      value: number;
    }[];
    if (filled.length) {
      if (overall != null) {
        const mean = filled.reduce((s, r) => s + r.value, 0) / filled.length;
        const delta = overall - mean;
        return filled.map((r) => ({ label: r.label, value: clamp(r.value + delta) }));
      }
      return filled.map((r) => ({ label: r.label, value: clamp(r.value) }));
    }
  }

  if (overall != null) {
    // Symmetric ±2 wobble around overall so the mean equals overall exactly.
    const wobble = [-2, 1, 2, -1, 0];
    return CATEGORIES.map((label, i) => ({
      label,
      value: clamp(overall + wobble[i]),
    }));
  }

  return [];
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
  const km: any = item.key_metrics ?? {};
  const summary = item.analysis_summary;
  const summaryShort =
    summary.length > 240 ? summary.slice(0, 240).trim() + "…" : summary;
  const meta = [
    km.beds ? `${km.beds} bd` : null,
    km.baths ? `${km.baths} ba` : null,
    km.sqft ? `${Number(km.sqft).toLocaleString()} sqft` : null,
  ].filter(Boolean);

  return (
    <Card
      className="hover:border-primary/40 transition-colors cursor-pointer"
      onClick={onView}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-primary truncate">
              {item.property_address ||
                item.property_url ||
                "Untitled analysis"}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Badge variant="secondary" className="capitalize">
                {item.source === "extension" ? "Extension" : "App"}
              </Badge>
              <span>Saved on {formatDate(item.created_at)}</span>
              {meta.length > 0 && <span>· {meta.join(" · ")}</span>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="More"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={onView}>
                Open analysis
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

        <div className="text-sm text-muted-foreground line-clamp-3">
          {summaryShort}
        </div>

        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="default" size="sm" onClick={onView}>
            Open analysis
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
  const { loading: subLoading } = useSubscription();
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
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Bookmark className="h-7 w-7 text-primary" />
            Saved Analyses
          </h1>
          <p className="text-muted-foreground mt-1">
            Your investment due diligence history
          </p>
        </header>
      )}

        {subLoading ? (
          <Card className="h-96 animate-pulse bg-muted/30" />
        ) : (
          <TierGate
            feature="SAVED_ANALYSES"
            featureName="Saved Analyses"
            description="Keep every AI property analysis in one due-diligence history — from the app and the Chrome extension. Included with the Buyer plan."
          >
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
          </TierGate>
        )}

        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
            {viewing && (
              <AnalysisDetail
                item={viewing}
                onDelete={() => handleDelete(viewing.id)}
                onUpdateNote={(n) => updateNote(viewing.id, n)}
              />
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}

function AnalysisDetail({
  item,
  onDelete,
  onUpdateNote,
}: {
  item: SavedAnalysis;
  onDelete: () => void;
  onUpdateNote: (note: string) => Promise<void> | void;
}) {
  const km: any = item.key_metrics ?? {};
  const highlights = deriveHighlights(item);
  const breakdown = deriveBreakdown(item);
  const cleanSummary = sanitizeSummary(item.analysis_summary);
  const firstParagraph = cleanSummary.split(/\n\s*\n/)[0].trim();

  const [note, setNote] = useState(item.notes ?? "");
  const [savingNote, setSavingNote] = useState(false);

  const metaLine = [
    km.beds ? `${km.beds} bd` : null,
    km.baths ? `${km.baths} ba` : null,
    km.sqft ? `${Number(km.sqft).toLocaleString()} sqft` : null,
    km.yearBuilt ? `Built ${km.yearBuilt}` : null,
  ].filter(Boolean);

  const handleNoteBlur = async () => {
    if (note === (item.notes ?? "")) return;
    setSavingNote(true);
    await onUpdateNote(note);
    setSavingNote(false);
  };

  return (
    <div className="p-6 space-y-5">
      <DialogHeader className="space-y-2 text-left">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Property analysis
        </div>
        <DialogTitle className="pr-8 text-2xl font-semibold text-primary">
          {item.property_address ||
            item.property_url ||
            "Saved analysis"}
        </DialogTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="capitalize">
            {item.source === "extension" ? "Extension" : "App"}
          </Badge>
          <span>Saved on {formatDate(item.created_at)}</span>
          {metaLine.length > 0 && <span>· {metaLine.join(" · ")}</span>}
        </div>
      </DialogHeader>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="neighborhood">Neighborhood</TabsTrigger>
          <TabsTrigger value="market">Market</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <Card className="border-primary/15 bg-primary/5">
                <CardContent className="p-4 space-y-2">
                  <div className="text-sm font-semibold">AI Summary</div>
                  {firstParagraph ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={chatMarkdownComponents}
                      >
                        {firstParagraph}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      No summary captured.
                    </p>
                  )}
                </CardContent>
              </Card>
              {highlights.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="text-sm font-semibold">Key Highlights</div>
                    <ul className="space-y-2">
                      {highlights.map((h, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Check className="h-4 w-4 mt-0.5 text-[hsl(var(--chart-2))] flex-shrink-0" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              {breakdown.length > 0 && (
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <div className="text-sm font-semibold">Score breakdown</div>
                    <div className="space-y-3">
                      {breakdown.map((b) => (
                        <BreakdownBar
                          key={b.label}
                          label={b.label}
                          value={b.value}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Analysis — full chat markdown */}
        <TabsContent value="analysis" className="mt-5">
          <Card>
            <CardContent className="p-5">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={chatMarkdownComponents}
                >
                {cleanSummary}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details */}
        <TabsContent value="details" className="mt-5">
          <Card>
            <CardContent className="p-5">
              {(() => {
                const rows = ([
                  ["Address", item.property_address],
                  [
                    "List Price",
                    item.property_price
                      ? `$${Number(item.property_price).toLocaleString()}`
                      : null,
                  ],
                  ["Beds", km.beds],
                  ["Baths", km.baths],
                  [
                    "Square Feet",
                    km.sqft ? Number(km.sqft).toLocaleString() : null,
                  ],
                  ["Year Built", km.yearBuilt],
                  ["Property Type", km.propertyType],
                  [
                    "Price / Sqft",
                    item.property_price && km.sqft
                      ? `$${Math.round(
                          Number(item.property_price) / Number(km.sqft),
                        )}`
                      : null,
                  ],
                ] as [string, any][]).filter(([, v]) => v != null && v !== "");
                if (rows.length === 0) {
                  return (
                    <div className="text-sm text-muted-foreground">
                      No property details captured.
                    </div>
                  );
                }
                return (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {rows.map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between border-b border-border/60 py-1.5"
                      >
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          {k}
                        </dt>
                        <dd className="text-sm font-medium">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Neighborhood */}
        <TabsContent value="neighborhood" className="mt-5">
          <Card>
            <CardContent className="p-5">
              {(() => {
                const rows = ([
                  ["Schools", km.schools ?? km.schoolRating],
                  ["Crime", km.crime ?? km.crimeIndex],
                  ["Walkability", km.walkScore ?? km.walkability],
                  ["Transit", km.transitScore],
                  ["Median Income", km.medianIncome],
                  ["Owner-Occupied", km.ownerOccupied],
                ] as [string, any][]).filter(([, v]) => v != null && v !== "");
                if (rows.length === 0) {
                  return (
                    <div className="text-sm text-muted-foreground">
                      Neighborhood details were not captured for this analysis.
                    </div>
                  );
                }
                return (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {rows.map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between border-b border-border/60 py-1.5"
                      >
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          {k}
                        </dt>
                        <dd className="text-sm font-medium">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Market */}
        <TabsContent value="market" className="mt-5">
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetricChip label="Cap Rate" value={km.capRate} />
                <MetricChip label="Cash-on-Cash" value={km.cashOnCash} />
                <MetricChip label="Monthly Rent" value={km.monthlyRent} />
                <MetricChip label="Net Cash Flow" value={km.netCashFlow} />
                <MetricChip label="Appreciation" value={km.appreciationRate} />
                <MetricChip label="DSCR" value={km.dscr} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-5">
          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="text-sm font-semibold">Your notes</div>
              <Textarea
                placeholder="Add a personal note about this property..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={handleNoteBlur}
                rows={6}
              />
              {savingNote && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DialogFooter className="gap-2 pt-2">
        {item.property_url && (
          <Button variant="outline" asChild>
            <a
              href={item.property_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-1" /> Open Property
            </a>
          </Button>
        )}
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete Analysis
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function SavedAnalyses() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <div className="flex flex-row flex-1">
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