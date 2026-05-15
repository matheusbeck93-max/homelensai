import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, X, MessageSquare, TrendingUp, DollarSign, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { chatMarkdownComponents } from "@/components/chat/markdownComponents";
import { US_STATES, getCitiesForState } from "@/data/usStatesCities";

type Goal = "cash_flow" | "appreciation" | "hybrid";
type Horizon = "short" | "mid" | "long";
type Risk = "low" | "medium" | "high";

interface TableRowData {
  market: string;
  medianPrice: string;
  rentalYield: string;
  appreciation5y: string;
  inventoryTrend: "rising" | "flat" | "falling" | "unknown";
  riskLevel: "low" | "medium" | "high" | "unknown";
}

interface ComparatorResult {
  verdict: { cashFlow: string; appreciation: string; bestFit: string; rationale: string };
  table: TableRowData[];
  insight: string;
  insightBullets: string[];
  dataNotes: string[];
  normalizedLabels: string[];
}

const inputSchema = z.object({
  budget: z.number().positive(),
  goal: z.enum(["cash_flow", "appreciation", "hybrid"]),
  horizon: z.enum(["short", "mid", "long"]),
  risk: z.enum(["low", "medium", "high"]),
  markets: z.array(z.string().min(1)).min(2).max(4),
});

const LOADING_STEPS = [
  "Fetching market data...",
  "Analyzing market pricing...",
  "Comparing rental yields...",
  "Evaluating risk levels...",
  "Synthesizing verdict...",
];

const GOAL_LABEL: Record<Goal, string> = {
  cash_flow: "Cash flow",
  appreciation: "Appreciation",
  hybrid: "Hybrid",
};
const HORIZON_LABEL: Record<Horizon, string> = {
  short: "Short-term (1–3y)",
  mid: "Mid-term (3–7y)",
  long: "Long-term (7+y)",
};
const RISK_LABEL: Record<Risk, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function trendBadge(t: TableRowData["inventoryTrend"]) {
  const map: Record<string, string> = {
    rising: "bg-chart-2/15 text-foreground",
    flat: "bg-muted text-foreground",
    falling: "bg-destructive/15 text-foreground",
    unknown: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[t]}>{t}</Badge>;
}

function riskBadge(r: TableRowData["riskLevel"]) {
  const map: Record<string, string> = {
    low: "bg-chart-2/15 text-foreground",
    medium: "bg-chart-4/15 text-foreground",
    high: "bg-destructive/15 text-foreground",
    unknown: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[r]}>{r}</Badge>;
}

function buildChatPrompt(args: {
  result: ComparatorResult;
  budget: number;
  goal: Goal;
  horizon: Horizon;
  risk: Risk;
}): string {
  const { result, budget, goal, horizon, risk } = args;
  const markets = result.normalizedLabels.length
    ? result.normalizedLabels
    : result.table.map((r) => r.market);
  const snapshot = result.table
    .map(
      (r) =>
        `- ${r.market}: ${r.medianPrice}, ${r.rentalYield} yield, risk ${r.riskLevel}`,
    )
    .join("\n");

  const bullets = result.insightBullets.slice(0, 3).map((b) => `- ${b}`).join("\n");

  const text =
`I just compared these markets in the Investor tool:
- Markets: ${markets.join(", ")}
- Budget: $${budget.toLocaleString("en-US")} | Goal: ${GOAL_LABEL[goal]} | Horizon: ${HORIZON_LABEL[horizon]} | Risk: ${RISK_LABEL[risk]}

Verdict:
- Cash flow: ${result.verdict.cashFlow}
- Appreciation: ${result.verdict.appreciation}
- Best fit: ${result.verdict.bestFit}

Snapshot:
${snapshot}

Key insight:
${bullets}

What should I do next given my budget, goal, and risk tolerance?`;

  if (text.length <= 1500) return text;
  return text.slice(0, 1497) + "...";
}

export function MarketComparator() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [budget, setBudget] = useState<string>("300000");
  const [goal, setGoal] = useState<Goal>("cash_flow");
  const [horizon, setHorizon] = useState<Horizon>("mid");
  const [risk, setRisk] = useState<Risk>("medium");
  const [markets, setMarkets] = useState<string[]>(["Tampa, FL", "Charlotte, NC"]);
  const [stateDraft, setStateDraft] = useState<string>("");
  const [cityDraft, setCityDraft] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparatorResult | null>(null);

  useEffect(() => {
    if (!loading) return;
    setStepIdx(0);
    const id = setInterval(() => {
      setStepIdx((i) => (i + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(id);
  }, [loading]);

  const cityOptions = useMemo(() => getCitiesForState(stateDraft), [stateDraft]);

  const addMarket = () => {
    if (!stateDraft || !cityDraft) return;
    if (markets.length >= 4) {
      toast({ title: "Limit reached", description: "Compare up to 4 markets." });
      return;
    }
    const v = `${cityDraft}, ${stateDraft}`;
    if (markets.some((m) => m.toLowerCase() === v.toLowerCase())) {
      setCityDraft("");
      return;
    }
    setMarkets([...markets, v]);
    setCityDraft("");
  };

  const removeMarket = (i: number) => {
    setMarkets(markets.filter((_, idx) => idx !== i));
  };

  const onSubmit = async () => {
    setError(null);
    const budgetNum = Number(budget.replace(/[,_$\s]/g, ""));
    const parsed = inputSchema.safeParse({
      budget: budgetNum,
      goal,
      horizon,
      risk,
      markets,
    });
    if (!parsed.success) {
      const msg =
        markets.length < 2
          ? "Add at least 2 markets to compare."
          : !Number.isFinite(budgetNum) || budgetNum <= 0
            ? "Enter a valid budget."
            : "Please review the inputs.";
      setError(msg);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("market-comparator", {
        body: parsed.data,
      });
      if (fnErr) throw fnErr;
      if (!data || (data as any).error) {
        throw new Error((data as any)?.error ?? "No data returned");
      }
      setResult(data as ComparatorResult);
    } catch (e: any) {
      const msg = e?.message ?? "Comparison failed. Please try again.";
      setError(msg);
      toast({ title: "Comparison failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAskAi = () => {
    if (!result) return;
    const initialMessage = buildChatPrompt({
      result,
      budget: Number(budget.replace(/[,_$\s]/g, "")),
      goal,
      horizon,
      risk,
    });
    navigate("/chats", { state: { initialMessage } });
  };

  const tableRows = useMemo(() => result?.table ?? [], [result]);

  return (
    <div className="space-y-6">
      {/* INPUT FORM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Market Comparator</CardTitle>
          <CardDescription>
            Compare 2–4 US markets against your budget, goal, horizon, and risk tolerance. Get a decision-oriented verdict and AI insight.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mc-budget">Budget (USD)</Label>
              <Input
                id="mc-budget"
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="300000"
              />
            </div>
            <div className="space-y-2">
              <Label>Investment goal</Label>
              <Select value={goal} onValueChange={(v) => setGoal(v as Goal)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_flow">Cash flow (rental income)</SelectItem>
                  <SelectItem value="appreciation">Appreciation</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time horizon</Label>
              <Select value={horizon} onValueChange={(v) => setHorizon(v as Horizon)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short-term (1–3 years)</SelectItem>
                  <SelectItem value="mid">Mid-term (3–7 years)</SelectItem>
                  <SelectItem value="long">Long-term (7+ years)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Risk tolerance</Label>
              <Select value={risk} onValueChange={(v) => setRisk(v as Risk)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Markets to compare ({markets.length}/4)</Label>
            <div className="flex flex-wrap gap-2">
              {markets.map((m, i) => (
                <Badge key={`${m}-${i}`} variant="secondary" className="gap-1 pl-3 pr-1 py-1">
                  {m}
                  <button
                    type="button"
                    onClick={() => removeMarket(i)}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                    aria-label={`Remove ${m}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">State</Label>
                <Select
                  value={stateDraft}
                  onValueChange={(v) => {
                    setStateDraft(v);
                    setCityDraft("");
                  }}
                  disabled={markets.length >= 4}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {US_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">City</Label>
                <Select
                  value={cityDraft}
                  onValueChange={setCityDraft}
                  disabled={!stateDraft || markets.length >= 4}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={stateDraft ? "Select city" : "Select state first"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {cityOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addMarket}
                  disabled={!stateDraft || !cityDraft || markets.length >= 4}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Pick a state, then choose a city. Compare up to 4 markets.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button onClick={onSubmit} disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Comparing...
                </>
              ) : (
                <>Compare Markets</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LOADING */}
      {loading && (
        <Card>
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {LOADING_STEPS[stepIdx]}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* RESULTS */}
      {result && !loading && (
        <>
          {/* VERDICT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <DollarSign className="h-4 w-4" /> Best for cash flow
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{result.verdict.cashFlow}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" /> Best for appreciation
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{result.verdict.appreciation}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Target className="h-4 w-4" /> Best fit for your profile
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{result.verdict.bestFit}</p>
              </CardContent>
            </Card>
          </div>

          {result.verdict.rationale && (
            <p className="text-sm text-muted-foreground">{result.verdict.rationale}</p>
          )}

          {/* TABLE */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Market</TableHead>
                    <TableHead>Median price</TableHead>
                    <TableHead>Rental yield</TableHead>
                    <TableHead>5-yr appreciation</TableHead>
                    <TableHead>Inventory</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row, i) => (
                    <TableRow key={`${row.market}-${i}`}>
                      <TableCell className="font-medium">{row.market}</TableCell>
                      <TableCell className={row.medianPrice === "n/a" ? "text-muted-foreground" : ""}>
                        {row.medianPrice}
                      </TableCell>
                      <TableCell className={row.rentalYield === "n/a" ? "text-muted-foreground" : ""}>
                        {row.rentalYield}
                      </TableCell>
                      <TableCell className={row.appreciation5y === "n/a" ? "text-muted-foreground" : ""}>
                        {row.appreciation5y}
                      </TableCell>
                      <TableCell>{trendBadge(row.inventoryTrend)}</TableCell>
                      <TableCell>{riskBadge(row.riskLevel)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* INSIGHT */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Insight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
                  {result.insight}
                </ReactMarkdown>
              </div>
              <Button onClick={handleAskAi} size="lg" className="w-full md:w-auto">
                <MessageSquare className="h-4 w-4 mr-2" />
                Ask AI what to do next
              </Button>
            </CardContent>
          </Card>

          {/* DATA NOTES */}
          {result.dataNotes && result.dataNotes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">Data notes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                  {result.dataNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default MarketComparator;