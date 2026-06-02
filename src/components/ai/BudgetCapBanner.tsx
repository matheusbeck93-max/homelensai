import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBudgetCap, formatResetCountdown } from "@/lib/ai/budgetCap";
import { UpgradeCTA } from "./UpgradeCTA";

interface BudgetCapBannerProps {
  surface: string;
}

/**
 * Compact "approaching cap" pill rendered above AI composers when the user
 * is at 75%+ of their daily limit but hasn't been blocked yet. Tapping it
 * opens a popover with the per-tier upgrade pitch.
 */
export function BudgetCapBanner({ surface }: BudgetCapBannerProps) {
  const cap = useBudgetCap();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (cap.warningLevel !== "approaching") return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [cap.warningLevel]);

  useEffect(() => {
    if (cap.warningLevel !== "approaching") return;
    try {
      window.dispatchEvent(
        new CustomEvent("homelens:budget_cap_approaching_shown", {
          detail: { tier: cap.tier, surface, usage_pct: cap.usagePct },
        }),
      );
    } catch { /* ignore */ }
  }, [cap.warningLevel, cap.tier, surface, cap.usagePct]);

  if (cap.warningLevel !== "approaching") return null;

  const remainingUsd = Math.max(0, cap.dailyLimitUsd - cap.usageTodayUsd);
  // ~$0.02 per typical Sonnet turn (see budgetGuard.ts pricing math).
  const TURN_COST_USD = 0.02;
  const remainingTurns = Math.max(1, Math.round(remainingUsd / TURN_COST_USD));
  const remainingLabel =
    remainingTurns === 1 ? "~1 turn left today" : `~${remainingTurns} turns left today`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 transition-colors touch-manipulation"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{remainingLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="text-sm font-medium">
          {cap.tierDisplay} plan: {remainingLabel}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatResetCountdown(cap.resetAt, now)}
        </div>
        {cap.tier !== "premium" && (
          <UpgradeCTA
            fromTier={cap.tier}
            source={surface}
            checkoutUrl={cap.upgrade.checkoutUrl}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

export default BudgetCapBanner;