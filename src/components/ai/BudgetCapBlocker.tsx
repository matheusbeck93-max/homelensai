import { useEffect, useState } from "react";
import { Clock, Lock } from "lucide-react";
import { useBudgetCap, formatResetCountdown } from "@/lib/ai/budgetCap";
import { UpgradeCTA } from "./UpgradeCTA";
import { TopUpPacks } from "./TopUpPacks";

interface BudgetCapBlockerProps {
  /** Identifier baked into the upgrade CTA URL as `source=cap_hit_<surface>`. */
  surface: string;
  /** Tighten the visual footprint when used inline in a small composer. */
  compact?: boolean;
}

/**
 * Inline blocker rendered below a disabled chat composer / refresh button
 * when the user has hit their daily AI cap. Includes the friendly message,
 * a live countdown, and a per-tier upgrade CTA (or nothing extra for the
 * top tier).
 */
export function BudgetCapBlocker({ surface, compact }: BudgetCapBlockerProps) {
  const cap = useBudgetCap();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (cap.warningLevel !== "exceeded") return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [cap.warningLevel]);

  // Emit "shown" event once per render-on; cheap because React will only
  // re-mount the blocker when the cap actually flips.
  useEffect(() => {
    if (cap.warningLevel !== "exceeded") return;
    try {
      window.dispatchEvent(
        new CustomEvent("homelens:budget_cap_hit_shown", {
          detail: { tier: cap.tier, surface, usage_today_usd: cap.usageTodayUsd },
        }),
      );
      if (cap.topup.available && cap.topup.packs.length > 0) {
        window.dispatchEvent(
          new CustomEvent("homelens:topup_offered", {
            detail: { tier: cap.tier, surface },
          }),
        );
      }
    } catch { /* ignore */ }
  }, [cap.warningLevel, cap.tier, surface, cap.usageTodayUsd, cap.topup.available, cap.topup.packs.length]);

  if (cap.warningLevel !== "exceeded") return null;

  const isMonthly = cap.capType === "monthly";
  const resetDateLabel = (isMonthly ? cap.monthlyResetAt : cap.resetAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const message = isMonthly
    ? cap.tier === "investor"
      ? `You've used this month's Investor allowance — most users don't reach this. Resets ${resetDateLabel}.`
      : cap.tier === "buyer"
        ? `You've used this month's Buyer assistant credits. Resets ${resetDateLabel}.`
        : `You've used this month's free assistant credits. Upgrade for more or come back ${resetDateLabel}.`
    : cap.tier === "investor"
      ? "You've used today's Investor cap — most users don't reach this. Resets at midnight."
      : cap.tier === "buyer"
        ? "You've hit today's Buyer assistant cap. Upgrade to Investor or try again tomorrow."
        : "You've used today's free assistant credits. Upgrade for more or try again tomorrow.";

  return (
    <div
      className={`rounded-lg border bg-muted/40 ${compact ? "p-3 space-y-2" : "p-4 space-y-3"}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm text-foreground">{message}</div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>{isMonthly ? `Resets ${resetDateLabel}` : formatResetCountdown(cap.resetAt, now)}</span>
      </div>
      {cap.upgrade.available && cap.tier !== "investor" && (
        <UpgradeCTA
          fromTier={cap.tier}
          source={surface}
          checkoutUrl={cap.upgrade.checkoutUrl}
        />
      )}
      {cap.topup.available && cap.topup.packs.length > 0 && (
        <TopUpPacks
          packs={cap.topup.packs}
          surface={surface}
          compact={compact}
          heading={cap.upgrade.available && cap.tier !== "investor" ? "Or buy more AI credits" : "Buy more AI credits"}
        />
      )}
    </div>
  );
}

export default BudgetCapBlocker;