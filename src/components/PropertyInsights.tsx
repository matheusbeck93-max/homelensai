import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, Home as HomeIcon } from "lucide-react";
import { HomeLensListing } from "@/types/ui-blocks";
import { DataFreshness } from "./DataFreshness";

interface PropertyInsightsProps {
  insights?: HomeLensListing['insights'];
  compact?: boolean;
}

export function PropertyInsights({ insights, compact = false }: PropertyInsightsProps) {
  if (!insights?.rentcast && !insights?.census) {
    return null;
  }

  const { rentcast, census } = insights;

  if (compact) {
    // Compact view for cards
    return (
      <div className="space-y-1.5 text-xs">
        {rentcast?.rent_estimate && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Est. Rent:</span>
            <span className="font-medium">${rentcast.rent_estimate.toLocaleString()}/mo</span>
          </div>
        )}
        {census?.median_household_income && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Area Income:</span>
            <span className="font-medium">${(census.median_household_income / 1000).toFixed(0)}k</span>
          </div>
        )}
      </div>
    );
  }

  // Full view for property details
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* RentCast Data */}
      {rentcast && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Rental Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {rentcast.rent_estimate && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-muted-foreground">Estimated Rent</span>
                  <span className="font-semibold text-base">
                    ${rentcast.rent_estimate.toLocaleString()}/mo
                  </span>
                </div>
                {(rentcast.rent_low || rentcast.rent_high) && (
                  <div className="text-xs text-muted-foreground">
                    Range: ${rentcast.rent_low?.toLocaleString() || 'N/A'} - ${rentcast.rent_high?.toLocaleString() || 'N/A'}
                  </div>
                )}
                {rentcast.confidence && (
                  <Badge variant="secondary" className="text-[10px] mt-1">
                    {rentcast.confidence} confidence
                  </Badge>
                )}
              </div>
            )}

            {rentcast.value_estimate && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Est. Value</span>
                <span className="font-medium">
                  ${rentcast.value_estimate.toLocaleString()}
                </span>
              </div>
            )}

            {rentcast.zip_market_summary && (
              <div className="pt-2 border-t space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">ZIP Market</div>
                {rentcast.zip_market_summary.median_rent && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Median Rent</span>
                    <span className="font-medium">
                      ${rentcast.zip_market_summary.median_rent.toLocaleString()}/mo
                    </span>
                  </div>
                )}
                {rentcast.zip_market_summary.rent_to_price_ratio && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Rent/Price Ratio</span>
                    <span className="font-medium">
                      {(rentcast.zip_market_summary.rent_to_price_ratio * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
                {rentcast.zip_market_summary.trend_label && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" />
                    <Badge 
                      variant={
                        rentcast.zip_market_summary.trend_label === 'rising' ? 'default' :
                        rentcast.zip_market_summary.trend_label === 'softening' ? 'destructive' : 
                        'secondary'
                      }
                      className="text-[10px]"
                    >
                      {rentcast.zip_market_summary.trend_label}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            <div className="text-[10px] text-muted-foreground pt-2">
              <DataFreshness
                sources={[{ name: "RentCast", type: "daily" }]}
                className="text-[10px]"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Census Data */}
      {census && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Area Demographics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {census.median_household_income && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Median Income</span>
                <span className="font-semibold text-base">
                  ${census.median_household_income.toLocaleString()}
                </span>
              </div>
            )}

            {(census.owner_occupied_rate !== null || census.renter_occupied_rate !== null) && (
              <div>
                <span className="text-muted-foreground block mb-1">Housing</span>
                <div className="flex gap-2">
                  {census.owner_occupied_rate !== null && (
                    <Badge variant="secondary" className="text-xs">
                      <HomeIcon className="h-3 w-3 mr-1" />
                      {(census.owner_occupied_rate * 100).toFixed(0)}% Owners
                    </Badge>
                  )}
                  {census.renter_occupied_rate !== null && (
                    <Badge variant="outline" className="text-xs">
                      {(census.renter_occupied_rate * 100).toFixed(0)}% Renters
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {census.median_age && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Median Age</span>
                <span className="font-medium">
                  {census.median_age.toFixed(1)} years
                </span>
              </div>
            )}

            {census.average_household_size && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Avg Household</span>
                <span className="font-medium">
                  {census.average_household_size.toFixed(1)} people
                </span>
              </div>
            )}

            <div className="text-[10px] text-muted-foreground pt-2">
              <DataFreshness
                sources={[{ name: "US Census", type: "monthly" }]}
                className="text-[10px]"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}