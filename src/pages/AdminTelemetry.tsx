import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert } from "lucide-react";

type Row = {
  created_at: string;
  tool_call_emitted: boolean;
  tool_call_count: number;
  had_prose: boolean;
  match_score: number | null;
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="text-sm text-muted-foreground">{hint}</CardContent>}
    </Card>
  );
}

export default function AdminTelemetry() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate(`/auth?redirect=${encodeURIComponent('/admin/telemetry')}`, { replace: true });
        return;
      }
      // Admin check via user_roles (RLS lets users see their own rows).
      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (roleErr || !roleRows) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error: qErr } = await supabase
        .from('tool_call_telemetry')
        .select('created_at,tool_call_emitted,tool_call_count,had_prose,match_score')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (qErr) setError(qErr.message);
      else setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [navigate]);

  const total = rows.length;
  const emitted = rows.filter(r => r.tool_call_emitted).length;
  const adoption = total > 0 ? Math.round((emitted / total) * 1000) / 10 : 0;
  const withProse = rows.filter(r => r.had_prose).length;
  const onlyTool = rows.filter(r => r.tool_call_emitted && !r.had_prose).length;
  const gateReached = adoption >= 95;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pb-12 max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Tool-Call Telemetry</h1>
          <p className="text-muted-foreground mt-2">
            Adoption of the <code>submit_match_score</code> tool on the ai-chat firecrawl branch. Step C ships when adoption is ≥ 95% over a 7-day window.
          </p>
        </header>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading telemetry…
          </div>
        )}

        {!loading && !isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden="true" />
                <CardTitle>Admin only</CardTitle>
              </div>
              <CardDescription>
                Your account does not have the admin role. Ask an existing admin to grant it via the <code>user_roles</code> table.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {!loading && isAdmin && error && (
          <Card>
            <CardHeader>
              <CardTitle>Failed to load</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {!loading && isAdmin && !error && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Stat label="Adoption (7d)" value={`${adoption}%`} hint={gateReached ? "Step C gate reached — safe to flip tool_choice to 'required'." : `Gate at 95%. ${(95 - adoption).toFixed(1)} pts to go.`} />
              <Stat label="Total firecrawl calls" value={String(total)} />
              <Stat label="Tool call emitted" value={String(emitted)} hint={`${withProse} also returned prose`} />
              <Stat label="Tool-only (no prose)" value={String(onlyTool)} hint="Server synthesizes MATCH_SCORE prefix for these" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent calls</CardTitle>
                <CardDescription>Last 50 of {total}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="py-2 pr-4">When</th>
                        <th className="py-2 pr-4">Tool</th>
                        <th className="py-2 pr-4">Prose</th>
                        <th className="py-2 pr-4">Calls</th>
                        <th className="py-2 pr-4">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                          <td className="py-2 pr-4">{r.tool_call_emitted ? "Yes" : "No"}</td>
                          <td className="py-2 pr-4">{r.had_prose ? "Yes" : "No"}</td>
                          <td className="py-2 pr-4">{r.tool_call_count}</td>
                          <td className="py-2 pr-4">{r.match_score ?? "—"}</td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No telemetry yet. Trigger an ai-chat firecrawl call to populate.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}