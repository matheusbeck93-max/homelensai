import { BarChart3 } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

export type MarketSnapshot = {
  areaLabel: string;
  zip?: string | null;
  city?: string | null;
  state?: string | null;
  medianRent?: number | null;
  medianHomeValue?: number | null;
  rentToPriceRatio?: number | null;
  trendLabel?: string | null;
  medianHouseholdIncome?: number | null;
  ownerOccupiedRate?: number | null;
  renterOccupiedRate?: number | null;
  medianAge?: number | null;
  averageHouseholdSize?: number | null;
  hasRentcastData: boolean;
  hasCensusData: boolean;
};

type MarketSnapshotCardProps = {
  snapshot: MarketSnapshot;
  subscriptionStatus: "free" | "pro" | "premium";
  onUpgradeClick?: () => void;
};

export function MarketSnapshotCard({
  snapshot,
  subscriptionStatus,
  onUpgradeClick,
}: MarketSnapshotCardProps) {
  const isFree = subscriptionStatus === "free";

  return (
    <Card className="w-full rounded-xl border border-border/60 bg-background/80 backdrop-blur-sm px-4 py-3 md:px-5 md:py-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span>Market snapshot: {snapshot.areaLabel}</span>
        </h3>
        <span className="text-[11px] md:text-xs px-2 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/20">
          Live area data
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
        {/* Left: RentCast metrics */}
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80 font-semibold">
            Market / rent metrics
          </p>
          {snapshot.medianRent != null && (
            <p>
              <span className="font-medium text-foreground">Median rent:</span>{" "}
              ${snapshot.medianRent.toLocaleString()}/mo
            </p>
          )}
          {snapshot.medianHomeValue != null && (
            <p>
              <span className="font-medium text-foreground">Median home value:</span>{" "}
              ${snapshot.medianHomeValue.toLocaleString()}
            </p>
          )}
          {!isFree && snapshot.rentToPriceRatio != null && (
            <p>
              <span className="font-medium text-foreground">Rent-to-price ratio:</span>{" "}
              {(snapshot.rentToPriceRatio * 100).toFixed(1)}%
            </p>
          )}
          {!isFree && snapshot.trendLabel && (
            <p>
              <span className="font-medium text-foreground">Trend:</span>{" "}
              {snapshot.trendLabel === "rising" && "📈 Rents rising"}
              {snapshot.trendLabel === "stable" && "➖ Relatively stable"}
              {snapshot.trendLabel === "softening" && "📉 Softening slightly"}
            </p>
          )}
        </div>

        {/* Right: Census metrics */}
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80 font-semibold">
            Income & occupancy
          </p>
          {snapshot.medianHouseholdIncome != null && (
            <p>
              <span className="font-medium text-foreground">Median household income:</span>{" "}
              ${snapshot.medianHouseholdIncome.toLocaleString()}
            </p>
          )}
          {snapshot.ownerOccupiedRate != null && snapshot.renterOccupiedRate != null && (
            <p>
              <span className="font-medium text-foreground">Owner vs renter:</span>{" "}
              {(snapshot.ownerOccupiedRate * 100).toFixed(0)}% owners ·{" "}
              {(snapshot.renterOccupiedRate * 100).toFixed(0)}% renters
            </p>
          )}
          {!isFree && snapshot.medianAge != null && (
            <p>
              <span className="font-medium text-foreground">Median age:</span>{" "}
              {snapshot.medianAge.toFixed(0)} yrs
            </p>
          )}
          {!isFree && snapshot.averageHouseholdSize != null && (
            <p>
              <span className="font-medium text-foreground">Avg household size:</span>{" "}
              {snapshot.averageHouseholdSize.toFixed(1)} people
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] md:text-[11px] text-muted-foreground/80">
        <span>Data from RentCast &amp; US Census (ZIP-level)</span>
        {isFree && onUpgradeClick && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-auto py-0.5 px-2 text-[10px] text-primary hover:bg-primary/10"
            onClick={onUpgradeClick}
          >
            Unlock full market insights with Pro
          </Button>
        )}
        {!isFree && (
          <span className="ml-auto text-[10px] text-emerald-500/80">
            Pro insight: full ZIP-level rent & income metrics
          </span>
        )}
      </div>
    </Card>
  );
}