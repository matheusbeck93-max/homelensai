import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { TopUpPacks } from "@/components/ai/TopUpPacks";
import type { CreditPackOption } from "@/lib/ai/budgetCap";
import {
  dismissExpiryToday,
  isExpiryDismissedToday,
} from "@/lib/account/expiryDismissal";

interface CreditsCardProps {
  tier: "free" | "buyer" | "investor";
  credits: {
    balance_usd: number;
    expires_at: string | null;
    expires_soon: boolean;
    recent_purchases: Array<{
      pack_size: string | null;
      amount_usd: number;
      price_usd: number;
      purchased_at: string;
    }>;
  };
  packs: CreditPackOption[];
}

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

export function CreditsCard({ tier, credits, packs }: CreditsCardProps) {
  const [expiryDismissed, setExpiryDismissed] = useState(false);

  useEffect(() => {
    setExpiryDismissed(isExpiryDismissedToday());
  }, []);

  const showExpiryBanner =
    credits.expires_soon && credits.expires_at && !expiryDismissed;

  return (
    <>
      {showExpiryBanner && (
        <Card className="p-4 border-amber-500/50 bg-amber-500/10 flex items-start justify-between gap-3">
          <p className="text-sm">
            {fmtUsd(credits.balance_usd)} in credits expire{" "}
            {new Date(credits.expires_at!).toLocaleDateString()}.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => {
              dismissExpiryToday();
              setExpiryDismissed(true);
            }}
            aria-label="Dismiss expiry warning for today"
          >
            <X className="h-4 w-4" />
          </Button>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="font-semibold text-lg">AI Credits</h2>
        <p className="mt-1 text-2xl font-semibold">{fmtUsd(credits.balance_usd)}</p>
        {credits.expires_at && (
          <p className="text-sm text-muted-foreground">
            Expires {new Date(credits.expires_at).toLocaleDateString()}
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-2">
          Credits are used after your daily/monthly cap.
        </p>
        {tier !== "free" && (
          <div className="mt-4">
            <TopUpPacks packs={packs} source="usage_page" heading="Buy more credits" />
          </div>
        )}
        {credits.recent_purchases.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Recent purchases
            </h3>
            <ul className="space-y-1 text-sm">
              {credits.recent_purchases.slice(0, 5).map((p, idx) => (
                <li key={idx} className="flex justify-between text-muted-foreground">
                  <span>
                    {p.pack_size ?? "Credit pack"} · {new Date(p.purchased_at).toLocaleDateString()}
                  </span>
                  <span>
                    {fmtUsd(p.price_usd)} → {fmtUsd(p.amount_usd)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </>
  );
}

export default CreditsCard;