import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { TopUpPacks } from "@/components/ai/TopUpPacks";
import type { CreditPackOption, CreditPackSize } from "@/lib/ai/budgetCap";

interface UsageSummary {
  tier: "free" | "buyer" | "investor";
  is_staff: boolean;
  tier_display_name: string;
  next_billing_date: string | null;
  today: null | {
    usage_usd: number;
    daily_limit_usd: number;
    usage_pct: number;
    remaining_turns_estimate: number;
    reset_at: string;
  };
  this_month: null | {
    usage_usd: number;
    monthly_limit_usd: number;
    usage_pct: number;
    days_remaining: number;
    projected_end_of_month_usd: number;
    projected_to_hit_cap: boolean;
    projected_cap_hit_date: string | null;
    reset_at: string;
  };
  credits: {
    balance_usd: number;
    topup_balance_usd?: number;
    plan_balance_usd?: number;
    expires_at: string | null;
    expires_soon: boolean;
    recent_purchases: Array<{
      pack_size: string | null;
      amount_usd: number;
      price_usd: number;
      purchased_at: string;
    }>;
  };
  per_surface_30d: Array<{ surface: string; calls: number; usage_usd: number }>;
  month_trend: Array<{ date: string; usage_usd: number }>;
  next_tier: null | {
    name: "buyer" | "investor";
    display_name: string;
    price_usd: number;
    daily_limit_usd: number;
    monthly_limit_usd: number;
    additional_features: string[];
    checkout_url: string;
  };
}

const PACK_DEFAULTS: CreditPackOption[] = [
  { size: "small", priceUsd: 5, creditUsd: 5, bonusPct: 0 },
  { size: "medium", priceUsd: 10, creditUsd: 11, bonusPct: 10 },
  { size: "large", priceUsd: 25, creditUsd: 30, bonusPct: 20 },
];

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

export default function UsagePage() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke("usage-summary", { method: "GET" });
    if (!error && data) setSummary(data as UsageSummary);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    try {
      window.dispatchEvent(new CustomEvent("homelens:usage_page_viewed"));
    } catch { /* ignore */ }
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-12 max-w-4xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">AI Usage</h1>
          <p className="text-muted-foreground mt-1">
            Track your daily and monthly AI consumption.
          </p>
        </header>

        {loading && <p className="text-muted-foreground">Loading…</p>}

        {summary?.is_staff && (
          <Card className="p-6">
            <h2 className="font-semibold text-lg">Internal account</h2>
            <p className="text-muted-foreground mt-1">
              No caps apply to this account.
            </p>
          </Card>
        )}

        {summary && !summary.is_staff && summary.today && summary.this_month && (
          <>
            {summary.credits.expires_soon && summary.credits.expires_at && (
              <Card className="p-4 border-amber-500/50 bg-amber-500/10">
                <p className="text-sm">
                  {fmtUsd(summary.credits.balance_usd)} in credits expire{" "}
                  {new Date(summary.credits.expires_at).toLocaleDateString()}.
                </p>
              </Card>
            )}

            <Card className="p-6">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <h2 className="font-semibold text-lg">
                  Today — {summary.tier_display_name} plan
                </h2>
                <span className="text-sm text-muted-foreground">
                  Resets {new Date(summary.today.reset_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between text-sm">
                <span>
                  <strong className="text-xl">{fmtUsd(summary.today.usage_usd)}</strong> used
                </span>
                <span className="text-muted-foreground">
                  {fmtUsd(Math.max(0, summary.today.daily_limit_usd - summary.today.usage_usd))} remaining
                </span>
              </div>
              <Progress value={summary.today.usage_pct} className="mt-2" />
              <p className="mt-2 text-sm text-muted-foreground">
                ~{summary.today.remaining_turns_estimate} chat turns remaining today
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="font-semibold text-lg">This month</h2>
              <div className="mt-3 flex items-baseline justify-between text-sm">
                <span>
                  <strong className="text-xl">{fmtUsd(summary.this_month.usage_usd)}</strong> of {fmtUsd(summary.this_month.monthly_limit_usd)}
                </span>
                <span className="text-muted-foreground">
                  {summary.this_month.days_remaining} days remaining
                </span>
              </div>
              <Progress value={summary.this_month.usage_pct} className="mt-2" />
              <p className="mt-3 text-sm">
                {summary.this_month.projected_to_hit_cap
                  ? `At your current pace, you'll hit the monthly cap around ${summary.this_month.projected_cap_hit_date ? new Date(summary.this_month.projected_cap_hit_date).toLocaleDateString() : "later this month"}.`
                  : "You're well within your monthly limit — no action needed."}
              </p>
            </Card>

            {summary.per_surface_30d.length > 0 && (
              <Card className="p-6">
                <h2 className="font-semibold text-lg">Where your AI usage goes (30 days)</h2>
                <ul className="mt-3 space-y-2">
                  {summary.per_surface_30d.slice(0, 8).map((s) => (
                    <li key={s.surface} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{s.surface.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">
                        {fmtUsd(s.usage_usd)} · {s.calls} calls
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="p-6">
              <h2 className="font-semibold text-lg">AI Credits</h2>
              <p className="mt-1 text-2xl font-semibold">{fmtUsd(summary.credits.balance_usd)}</p>
              {summary.credits.expires_at && (
                <p className="text-sm text-muted-foreground">
                  Expires {new Date(summary.credits.expires_at).toLocaleDateString()}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Credits are used after your daily/monthly cap.
              </p>
              {summary.tier !== "free" && (
                <div className="mt-4">
                  <TopUpPacks packs={PACK_DEFAULTS} surface="usage_page" heading="Buy more credits" />
                </div>
              )}
            </Card>

            {summary.next_tier && (
              <Card className="p-6">
                <h2 className="font-semibold text-lg">
                  Upgrade to {summary.next_tier.display_name} — ${summary.next_tier.price_usd}/mo
                </h2>
                <ul className="mt-3 space-y-1 text-sm">
                  <li>Daily: {fmtUsd(summary.next_tier.daily_limit_usd)}</li>
                  <li>Monthly: {fmtUsd(summary.next_tier.monthly_limit_usd)}</li>
                  {summary.next_tier.additional_features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <Button asChild className="mt-4">
                  <Link to={summary.next_tier.checkout_url}>Upgrade</Link>
                </Button>
              </Card>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}