import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { BackendTier } from "@/lib/ai/budgetCap";
import {
  emitUsageEvent,
  type CapType,
  type UsageEventSource,
} from "@/lib/telemetry/usageEvents";

interface UpgradeCTAProps {
  fromTier: BackendTier;
  /** Real AI surface id (e.g. `general_chat`) — appended to checkout URL as `source=cap_hit_<surface>`. */
  surface: string;
  /** Canonical telemetry source enum. */
  eventSource: UsageEventSource;
  /** Which cap fired, when applicable. */
  capType?: CapType;
  /** Optional override of the next-tier checkout URL from the 402 payload. */
  checkoutUrl?: string | null;
}

const COPY: Record<BackendTier, { headline: string; body: string; cta: string } | null> = {
  free: {
    headline: "Get unlimited daily chat with Buyer",
    body: "$9.97/mo — unlimited property analyses, full chat history, and HomeLens chat in the Chrome extension.",
    cta: "Upgrade to Buyer",
  },
  buyer: {
    headline: "Unlock Investor tools",
    body: "$24.97/mo — everything in Buyer, plus 20-year IRR projections, stress scenarios, the Market Comparator, and investor-grade Excel exports.",
    cta: "Upgrade to Investor",
  },
  investor: null,
};

export function UpgradeCTA({
  fromTier,
  surface,
  eventSource,
  capType,
  checkoutUrl,
}: UpgradeCTAProps) {
  const navigate = useNavigate();
  const copy = COPY[fromTier];
  if (!copy) return null;

  const nextTier: BackendTier = fromTier === "free" ? "buyer" : "investor";

  const handleClick = async () => {
    // Generate a cap_session_id, persist the click server-side, then carry
    // the id through Stripe checkout (via Pricing → create-checkout →
    // Stripe metadata → webhook) so we can credit the conversion later.
    const capSessionId =
      (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    emitUsageEvent("homelens:upgrade_cta_clicked", {
      tier: fromTier,
      source: eventSource,
      to_tier: nextTier,
      cap_session_id: capSessionId,
      cap_type: capType,
      surface,
    });

    // Fire-and-forget — UX shouldn't block on telemetry.
    supabase.functions.invoke("upgrade-cta-click", {
      body: {
        cap_session_id: capSessionId,
        source: surface,
        from_tier: fromTier,
      },
    }).catch(() => { /* ignore */ });

    const base =
      checkoutUrl ??
      `/pricing?plan=${nextTier}&source=cap_hit_${surface}`;
    const sep = base.includes("?") ? "&" : "?";
    navigate(`${base}${sep}cap=${capSessionId}`);
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
      <div className="font-semibold text-foreground">{copy.headline}</div>
      <div className="text-sm text-muted-foreground">{copy.body}</div>
      <Button size="sm" onClick={handleClick} className="mt-1">
        {copy.cta} →
      </Button>
    </div>
  );
}

export default UpgradeCTA;