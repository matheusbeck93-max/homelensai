import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { CreditPackOption, CreditPackSize } from "@/lib/ai/budgetCap";

interface TopUpPacksProps {
  packs: CreditPackOption[];
  /** Surface that triggered this picker — used for telemetry attribution. */
  surface: string;
  /** Tightens spacing for inline use inside the cap blocker. */
  compact?: boolean;
  /** Optional caption above the cards. */
  heading?: string;
}

/**
 * Three credit-pack cards. Used both inside `BudgetCapBlocker` (cap-hit
 * flow) and inside `TopUpDialog` (proactive purchase from Console).
 * Click → `buy-credits` edge function → Stripe Checkout in a new tab.
 */
export function TopUpPacks({ packs, surface, compact, heading }: TopUpPacksProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState<CreditPackSize | null>(null);

  if (!packs || packs.length === 0) return null;

  const handleBuy = async (size: CreditPackSize) => {
    setPending(size);
    try {
      try {
        window.dispatchEvent(
          new CustomEvent("homelens:topup_pack_clicked", {
            detail: { pack_size: size, surface },
          }),
        );
      } catch { /* ignore */ }
      const { data, error } = await supabase.functions.invoke("buy-credits", {
        body: { pack: size, source: surface },
      });
      if (error) {
        toast({
          title: "Could not start checkout",
          description: error.message ?? "Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      const url = (data as { url?: string } | null)?.url;
      if (!url) {
        toast({
          title: "Checkout unavailable",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {heading && (
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {heading}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {packs.map((p) => {
          const isPending = pending === p.size;
          const label =
            p.size === "small" ? "Small" : p.size === "medium" ? "Medium" : "Large";
          return (
            <button
              key={p.size}
              type="button"
              disabled={isPending || pending !== null}
              onClick={() => handleBuy(p.size)}
              className="rounded-lg border bg-card hover:bg-accent transition-colors p-3 text-left disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-base font-semibold text-foreground">
                ${p.priceUsd}
              </div>
              <div className="text-xs text-muted-foreground">
                Get ${p.creditUsd}
                {p.bonusPct > 0 && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Sparkles className="h-3 w-3" />
                    +{p.bonusPct}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="text-[11px] text-muted-foreground">
        One-time purchase. Credits expire 90 days after purchase.
      </div>
    </div>
  );
}

export default TopUpPacks;