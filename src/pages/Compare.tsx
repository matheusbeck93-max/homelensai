import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useComparison } from "@/contexts/ComparisonContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Navigation } from "@/components/Navigation";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, X, Heart } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";

export default function Compare() {
  const navigate = useNavigate();
  const { selectedProperties, removeFromComparison, clearComparison } = useComparison();
  const { tier } = useSubscription();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  useEffect(() => {
    if (selectedProperties.length === 0) {
      navigate("/");
    }
  }, [selectedProperties.length, navigate]);

  if (selectedProperties.length === 0) {
    return null;
  }

  const isFree = tier === "free";
  const formatPrice = (price: number | null) =>
    price ? `$${price.toLocaleString()}` : "N/A";
  const formatNumber = (num: number | null) => (num ? num.toLocaleString() : "N/A");

  const calculatePricePerSqft = (price: number | null, sqft: number | null) => {
    if (price && sqft) {
      return `$${Math.round(price / sqft)}/sqft`;
    }
    return "N/A";
  };

  const calculateGrossYield = (rent: number | null, price: number | null) => {
    if (rent && price) {
      return ((rent * 12) / price * 100).toFixed(2) + "%";
    }
    return "N/A";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 container mx-auto px-4 py-6 pb-24 md:pb-6">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to results
          </Button>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            <span className="text-sm text-muted-foreground">
              Comparing {selectedProperties.length} properties
            </span>
            <Button variant="outline" onClick={clearComparison} className="w-full sm:w-auto">
              Clear comparison
            </Button>
          </div>
        </div>

        {isFree && (
          <Card className="mb-6 p-4 bg-primary/5 border-primary/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Free Plan Limit</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Compare up to 5 properties side by side with HomeLens Pro.
                </p>
              </div>
              <Button size="sm" onClick={() => setUpgradeModalOpen(true)}>
                Upgrade to Pro
              </Button>
            </div>
          </Card>
        )}

        {/* Comparison Table */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="inline-flex gap-3 sm:gap-4 pb-4">
            {selectedProperties.map((property) => {
              const isPropertyFavorite = isFavorite(property.id);

              return (
                <Card key={property.id} className="min-w-[260px] sm:min-w-[280px] max-w-[300px] sm:max-w-[320px] p-3 sm:p-4 flex-shrink-0">
                  {/* Property Header */}
                  <div className="relative mb-4">
                    {property.photoUrl && (
                      <img
                        src={property.photoUrl}
                        alt={property.address}
                        className="w-full h-40 object-cover rounded-lg"
                      />
                    )}
                    <button
                      onClick={() => removeFromComparison(property.id)}
                      className="absolute top-2 right-2 p-1.5 bg-background/90 rounded-full hover:bg-background"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleFavorite(property)}
                      className="absolute top-2 left-2 p-1.5 bg-background/90 rounded-full hover:bg-background"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          isPropertyFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {formatPrice(property.price)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {property.address}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {property.city}, {property.state} {property.zip}
                      </p>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                        Basic Info
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Beds:</span>
                          <span className="font-medium">{property.beds || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Baths:</span>
                          <span className="font-medium">{property.baths || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sq Ft:</span>
                          <span className="font-medium">{formatNumber(property.sqft)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price/Sq Ft:</span>
                          <span className="font-medium">
                            {calculatePricePerSqft(property.price, property.sqft)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cost & Rent */}
                    {property.insights?.rentcast && (
                      <div className="space-y-2 pt-2 border-t">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                          Cost & Rent
                        </h4>
                        <div className="space-y-1 text-sm">
                          {property.insights.rentcast.rent_estimate && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Est. Rent:</span>
                              <span className="font-medium">
                                ${property.insights.rentcast.rent_estimate.toLocaleString()}/mo
                              </span>
                            </div>
                          )}
                          {property.insights.rentcast.zip_market_summary?.median_rent && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Local Median:</span>
                              <span className="font-medium">
                                $
                                {property.insights.rentcast.zip_market_summary.median_rent.toLocaleString()}
                                /mo
                              </span>
                            </div>
                          )}
                          {!isFree &&
                            property.insights.rentcast.rent_estimate &&
                            property.price && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Gross Yield:</span>
                                <span className="font-medium">
                                  {calculateGrossYield(
                                    property.insights.rentcast.rent_estimate,
                                    property.price
                                  )}
                                </span>
                              </div>
                            )}
                        </div>
                      </div>
                    )}

                    {/* Neighborhood */}
                    {property.insights?.census && !isFree && (
                      <div className="space-y-2 pt-2 border-t">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                          Neighborhood
                        </h4>
                        <div className="space-y-1 text-sm">
                          {property.insights.census.median_household_income && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Median Income:</span>
                              <span className="font-medium">
                                $
                                {property.insights.census.median_household_income.toLocaleString()}
                              </span>
                            </div>
                          )}
                          {property.insights.census.owner_occupied_rate != null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Owner Rate:</span>
                              <span className="font-medium">
                                {(property.insights.census.owner_occupied_rate * 100).toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-4"
                      onClick={() => navigate(`/property/${property.id}`)}
                    >
                      View Details
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </main>

      <MobileBottomNav />
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature="Property Comparison (up to 5 properties)"
      />
    </div>
  );
}