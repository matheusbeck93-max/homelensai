import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { useBudgetCap } from "@/lib/ai/budgetCap";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TopUpDialog } from "@/components/ai/TopUpDialog";
import { emitUsageEvent } from "@/lib/telemetry/usageEvents";

/**
 * Compact ⚡ chip in the header showing current AI-budget consumption.
 * - Hidden for unauthenticated users and staff accounts.
 * - Color-codes by the larger of daily/monthly usage %.
 * - Click opens a popover summary; CTA links to /account/usage.
 */
export function HeaderUsageIndicator() {
  const navigate = useNavigate();
  const state = useBudgetCap();

  if (!state.loaded || state.isStaff) return null;

  const dailyPct = Math.round((state.usagePct ?? 0) * 100);
  const monthlyPct = Math.round((state.monthlyUsagePct ?? 0) * 100);
  const pct = Math.max(dailyPct, monthlyPct);
  const driver = monthlyPct > dailyPct ? "monthly" : "daily";
  const showTopUpShortcut =
    state.tier !== "free" && state.topup.available && pct >= 50;

  const handleViewUsage = () => {
    emitUsageEvent("homelens:usage_indicator_clicked", {
      tier: state.tier,
      source: "header_chip",
      pct,
      driver,
    });
    navigate("/account/usage");
  };

  let color = "text-muted-foreground border-border";
  if (pct >= 100) color = "text-destructive border-destructive/40 bg-destructive/5";
  else if (pct >= 80) color = "text-amber-600 border-amber-500/40 bg-amber-500/5";
  else if (pct >= 50) color = "text-primary border-primary/30 bg-primary/5";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`AI usage ${pct}% of ${driver} cap`}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition hover:opacity-80 ${color}`}
        >
          <Zap className="h-3 w-3" />
          {pct}%
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">AI usage</span>
            <span className="text-xs text-muted-foreground">{state.tierDisplay}</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Today</span>
              <span>{dailyPct}% of ${state.dailyLimitUsd.toFixed(2)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(dailyPct, 100)}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">This month</span>
              <span>{monthlyPct}% of ${state.monthlyLimitUsd.toFixed(2)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(monthlyPct, 100)}%` }}
              />
            </div>
          </div>
          {state.creditsBalanceUsd > 0 && (
            <div className="text-xs text-muted-foreground">
              Credit balance: ${state.creditsBalanceUsd.toFixed(2)}
            </div>
          )}
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={handleViewUsage}
            >
              View usage details
            </Button>
            {showTopUpShortcut && (
              <div className="flex justify-center">
                <TopUpDialog
                  source="header_chip"
                  triggerLabel="Buy credits"
                  triggerVariant="default"
                />
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}