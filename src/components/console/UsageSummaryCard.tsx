import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Clock, ArrowRight } from "lucide-react";
import { useBudgetCap } from "@/lib/ai/budgetCap";
import { TopUpDialog } from "@/components/ai/TopUpDialog";
import { emitUsageEvent } from "@/lib/telemetry/usageEvents";

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

function msUntilNextUtcReset(): number {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return next.getTime() - now.getTime();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0h 0m";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function UsageSummaryCard() {
  const navigate = useNavigate();
  const cap = useBudgetCap();
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilNextUtcReset()));

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(msUntilNextUtcReset()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (cap.isStaff) return null;

  if (!cap.loaded) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const dayPct = Math.min(100, Math.round(cap.usagePct * 100));
  const monthPct = Math.min(100, Math.round(cap.monthlyUsagePct * 100));
  const exceeded = cap.warningLevel === "exceeded";
  const approaching = cap.warningLevel === "approaching";
  const canUpgrade = cap.upgrade.available && cap.tier !== "investor";

  return (
    <Card className={exceeded ? "border-destructive" : approaching ? "border-amber-500/60" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Usage
          </span>
          <span className="text-xs font-normal text-muted-foreground">{cap.tierDisplay} plan</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between mb-1 text-sm">
            <span className="font-medium">Today</span>
            <span className="text-muted-foreground">
              {fmtUsd(cap.usageTodayUsd)} of {fmtUsd(cap.dailyLimitUsd)}
            </span>
          </div>
          <Progress value={dayPct} className="h-2" />
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Resets in {countdown}</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1 text-sm">
            <span className="font-medium">This month</span>
            <span className="text-muted-foreground">
              {fmtUsd(cap.usageMonthUsd)} of {fmtUsd(cap.monthlyLimitUsd)}
            </span>
          </div>
          <Progress value={monthPct} className="h-1.5" />
        </div>

        {cap.creditsBalanceUsd > 0 && (
          <p className="text-xs text-muted-foreground">
            + {fmtUsd(cap.creditsBalanceUsd)} in credits available after your cap
            {cap.creditsNextExpiresAt
              ? ` (expires ${cap.creditsNextExpiresAt.toLocaleDateString()})`
              : ""}
            .
          </p>
        )}

        {exceeded && (
          <p className="text-xs text-destructive">
            {cap.capType === "monthly" ? "Monthly" : "Daily"} cap reached.
            {cap.topup.available
              ? " Buy credits to keep going, or upgrade your plan."
              : " Upgrade your plan to keep going."}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              emitUsageEvent("homelens:usage_indicator_clicked", {
                tier: cap.tier,
                source: "header_chip",
                pct: Math.max(cap.usagePct, cap.monthlyUsagePct),
                driver: cap.monthlyUsagePct > cap.usagePct ? "monthly" : "daily",
                cap_type: cap.capType ?? undefined,
              });
              navigate("/account/usage");
            }}
          >
            View details
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          {cap.topup.available && (
            <TopUpDialog
              source="overview_card"
              triggerLabel="Buy credits"
              triggerVariant="outline"
            />
          )}

          {canUpgrade && cap.upgrade.nextTier && (
            <Button
              size="sm"
              variant={exceeded ? "default" : "ghost"}
              onClick={() => {
                emitUsageEvent("homelens:upgrade_cta_clicked", {
                  tier: cap.tier,
                  source: "overview_card",
                  to_tier: cap.upgrade.nextTier!,
                  cap_type: cap.capType ?? undefined,
                });
                navigate("/pricing");
              }}
            >
              Upgrade to {cap.upgrade.nextTierDisplay}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default UsageSummaryCard;