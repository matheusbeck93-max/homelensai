import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, Activity, Zap, ShieldAlert, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

interface SpendData {
  todayProdSpend: number;
  todayDevSpend: number;
  todayByModel: Record<string, number>;
  todayBySurface: Record<string, number>;
  trend7Days: Record<string, { prod: number; dev: number }>;
  cacheHitRate: number;
  totalCalls: number;
}

export default function AiSpendAdmin() {
  const [data, setData] = useState<SpendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpend = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const res = await supabase.functions.invoke("admin-ai-spend", {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (res.error) throw new Error(res.error.message || "Failed to fetch spend");
      setData(res.data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpend();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Spend Telemetry & Controls</h1>
              <p className="text-sm text-muted-foreground">Real-time gateway monitoring, USD tier caps ($1/$10/$25), prompt cache rates, and dev/prod spend isolation.</p>
            </div>
          </div>
          <Button onClick={fetchSpend} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6 flex items-center gap-3 text-destructive">
              <ShieldAlert className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading && !data ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="h-32 bg-muted/50" />
            ))}
          </div>
        ) : data ? (
          <>
            {/* KPI Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Today Prod Spend</CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${data.todayProdSpend.toFixed(4)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Debited against tier budgets</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Today Dev/Preview Spend</CardTitle>
                  <Activity className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-500">${data.todayDevSpend.toFixed(4)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Isolated from prod ledger</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Prompt Cache Hit Rate</CardTitle>
                  <Zap className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-500">{(data.cacheHitRate * 100).toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Target &gt;70% (ephemeral prefix)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">7-Day Calls Monitored</CardTitle>
                  <Activity className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalCalls}</div>
                  <p className="text-xs text-muted-foreground mt-1">Haiku + Sonnet + Perplexity</p>
                </CardContent>
              </Card>
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Today&apos;s Spend by Model</CardTitle>
                  <CardDescription>Gateway routing across Claude Sonnet, Haiku 4.5, and Perplexity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(data.todayByModel).length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No production model spend recorded today.</p>
                  ) : (
                    Object.entries(data.todayByModel).map(([model, cost]) => (
                      <div key={model} className="flex items-center justify-between">
                        <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{model}</span>
                        <span className="text-sm font-semibold">${cost.toFixed(5)}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Today&apos;s Spend by Surface</CardTitle>
                  <CardDescription>Attribution across consumer chat, investor briefs, and memory</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(data.todayBySurface).length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No surface spend recorded today.</p>
                  ) : (
                    Object.entries(data.todayBySurface).map(([surface, cost]) => (
                      <div key={surface} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{surface}</span>
                        <span className="text-sm font-semibold">${cost.toFixed(5)}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 7-Day Trend Card */}
            <Card>
              <CardHeader>
                <CardTitle>7-Day Spend Trend (Prod vs Dev)</CardTitle>
                <CardDescription>Daily USD cost aggregation comparing preview testing vs live traffic</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(data.trend7Days).sort().reverse().map(([date, val]) => (
                    <div key={date} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <span className="text-sm font-mono text-muted-foreground">{date}</span>
                      <div className="flex items-center gap-6">
                        <span className="text-sm">Prod: <strong className="text-foreground">${val.prod.toFixed(4)}</strong></span>
                        <span className="text-sm text-amber-500">Dev: <strong>${val.dev.toFixed(4)}</strong></span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(data.trend7Days).length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No spend history available for the last 7 days.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}