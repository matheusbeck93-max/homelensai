import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Search, FileWarning, ExternalLink } from "lucide-react";

interface SitemapEntry {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  type?: string;
  errors?: string;
  warnings?: string;
  contents?: Array<{ type?: string; submitted?: string; indexed?: string }>;
}

interface AnalyticsRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface InsightsPayload {
  site: string;
  verified: boolean;
  window: { startDate: string; endDate: string };
  sitemaps: SitemapEntry[];
  sitemapsError: unknown;
  topQueries: AnalyticsRow[];
  topPages: AnalyticsRow[];
  totals: AnalyticsRow | null;
  cached: boolean;
  fetchedAt: string;
}

function fmtNum(n?: number) {
  if (n == null) return "—";
  return Math.round(n).toLocaleString();
}
function fmtPct(n?: number) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(2)}%`;
}
function fmtPos(n?: number) {
  if (n == null) return "—";
  return n.toFixed(1);
}

export function SeoInsightsPanel() {
  const { toast } = useToast();
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.functions.invoke("gsc-insights", {
      body: refresh ? { refresh: 1 } : {},
    });
    if (err) {
      const ctx: any = (err as any).context;
      let msg = err.message;
      try {
        const j = await ctx?.json?.();
        if (j?.error) msg = j.error;
      } catch { /* ignore */ }
      setError(msg || "Failed to load Google Search Console data");
    } else {
      setData(res as InsightsPayload);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const requestVerifyToken = async () => {
    const { data: res, error: err } = await supabase.functions.invoke("gsc-insights", {
      body: { action: "verify-token" },
    });
    if (err || !(res as any)?.token) {
      toast({ title: "Could not get verification token", description: err?.message ?? "Unknown error", variant: "destructive" });
      return;
    }
    setVerifyToken((res as any).token);
  };

  const confirmVerification = async () => {
    const { data: res, error: err } = await supabase.functions.invoke("gsc-insights", {
      body: { action: "verify-confirm" },
    });
    if (err || !(res as any)?.ok) {
      toast({ title: "Verification failed", description: "Make sure the meta tag is deployed at homelensais.com.", variant: "destructive" });
      return;
    }
    toast({ title: "Verified", description: "Site verified and sitemap submitted to Google." });
    load(true);
  };

  const submitSitemap = async () => {
    const { error: err } = await supabase.functions.invoke("gsc-insights", {
      body: { action: "submit-sitemap" },
    });
    if (err) {
      toast({ title: "Sitemap submission failed", description: err.message, variant: "destructive" });
    } else {
      toast({ title: "Sitemap submitted", description: "Google will refetch shortly." });
      load(true);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading Search Console data…</div>;
  }

  if (error) {
    const isForbidden = /Forbidden|allowlist/i.test(error);
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{isForbidden ? "Access restricted" : "Could not load Search Console"}</AlertTitle>
        <AlertDescription>
          {error}
          {isForbidden && (
            <div className="mt-2 text-sm">
              Add your account email to the <code>GSC_ADMIN_EMAILS</code> secret (comma-separated) in Lovable Cloud, then refresh.
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">SEO & Indexing</h2>
          <p className="text-sm text-muted-foreground">
            Google Search Console for {data.site} · last 28 days
            {data.fetchedAt && ` · updated ${new Date(data.fetchedAt).toLocaleTimeString()}`}
            {data.cached && " (cached)"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.verified ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Verified for <code>{data.site}</code>
            </div>
          ) : (
            <>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Site not verified yet</AlertTitle>
                <AlertDescription>
                  Get a meta tag, paste it into <code>index.html</code> {`<head>`}, deploy, then click Confirm.
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={requestVerifyToken}>Get verification meta tag</Button>
                <Button size="sm" variant="outline" onClick={confirmVerification}>Confirm verification</Button>
              </div>
              {verifyToken && (
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`<meta name="google-site-verification" content="${verifyToken}" />`}
                </pre>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Sitemap health */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5" />
              Sitemap health
            </CardTitle>
            <CardDescription>Submitted sitemaps and Google's last fetch</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={submitSitemap}>Submit sitemap</Button>
        </CardHeader>
        <CardContent>
          {data.sitemaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sitemaps submitted yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Last downloaded</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">Warnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sitemaps.map((s) => {
                  const errs = Number(s.errors ?? 0);
                  const warns = Number(s.warnings ?? 0);
                  return (
                    <TableRow key={s.path}>
                      <TableCell className="font-mono text-xs">
                        <a href={s.path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                          {s.path.replace("https://homelensais.com", "")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.lastDownloaded ? new Date(s.lastDownloaded).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {errs > 0 ? <Badge variant="destructive">{errs}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {warns > 0 ? <Badge variant="secondary">{warns}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Clicks (28d)</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{fmtNum(data.totals?.clicks)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Impressions (28d)</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{fmtNum(data.totals?.impressions)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>CTR</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{fmtPct(data.totals?.ctr)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg. position</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{fmtPos(data.totals?.position)}</div></CardContent></Card>
      </div>

      {/* Top queries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Top queries</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No query data yet — Google needs a few days of data after verification.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Query</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Impr.</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Pos.</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.topQueries.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.keys?.[0]}</TableCell>
                    <TableCell className="text-right">{fmtNum(r.clicks)}</TableCell>
                    <TableCell className="text-right">{fmtNum(r.impressions)}</TableCell>
                    <TableCell className="text-right">{fmtPct(r.ctr)}</TableCell>
                    <TableCell className="text-right">{fmtPos(r.position)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top pages */}
      <Card>
        <CardHeader><CardTitle>Top pages</CardTitle></CardHeader>
        <CardContent>
          {data.topPages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No page data yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Impr.</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Pos.</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.topPages.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs truncate max-w-[280px]">
                      <a href={r.keys?.[0]} target="_blank" rel="noreferrer" className="hover:underline">
                        {(r.keys?.[0] || "").replace("https://homelensais.com", "") || "/"}
                      </a>
                    </TableCell>
                    <TableCell className="text-right">{fmtNum(r.clicks)}</TableCell>
                    <TableCell className="text-right">{fmtNum(r.impressions)}</TableCell>
                    <TableCell className="text-right">{fmtPct(r.ctr)}</TableCell>
                    <TableCell className="text-right">{fmtPos(r.position)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
