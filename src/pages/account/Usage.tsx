import { useEffect, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { CreditPackOption } from "@/lib/ai/budgetCap";
import { UsageHero } from "@/components/account/usage/UsageHero";
import { MonthlyUsageCard } from "@/components/account/usage/MonthlyUsageCard";
import { UsageTrendChart } from "@/components/account/usage/UsageTrendChart";
import { SurfaceBreakdown } from "@/components/account/usage/SurfaceBreakdown";
import { CreditsCard } from "@/components/account/usage/CreditsCard";
import { NextTierCompare } from "@/components/account/usage/NextTierCompare";
import { emitUsageEvent } from "@/lib/telemetry/usageEvents";

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
    return () => window.clearInterval(id);
  }, []);

  // Fire the page-viewed event once we have the summary in hand so the
  // payload includes tier + percentages.
  useEffect(() => {
    if (!summary) return;
    emitUsageEvent("homelens:usage_page_viewed", {
      tier: summary.tier,
      pct_day: summary.today?.usage_pct,
      pct_month: summary.this_month?.usage_pct,
      credits_balance: summary.credits?.balance_usd,
    });
  }, [summary?.tier]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pb-12 max-w-4xl space-y-6">
        <header>
          <h1 className="text-4xl font-bold mb-2">AI Usage</h1>
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
            <UsageHero
              tierDisplayName={summary.tier_display_name}
              today={summary.today}
            />
            <MonthlyUsageCard thisMonth={summary.this_month} />
            <UsageTrendChart data={summary.month_trend} />
            <SurfaceBreakdown surfaces={summary.per_surface_30d} />
            <CreditsCard
              tier={summary.tier}
              credits={summary.credits}
              packs={PACK_DEFAULTS}
            />
            {summary.next_tier && <NextTierCompare nextTier={summary.next_tier} />}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}