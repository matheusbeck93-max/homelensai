import React, { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Home, List, Map as MapIcon } from "lucide-react";
import { HomeLensListing } from "@/types/ui-blocks";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { calculatePriceFairness } from "@/lib/pricingUtils";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/calculations";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface PropertyResultsCarouselProps {
  title: string;
  properties: HomeLensListing[];
  onAnalyze?: (property: HomeLensListing) => void;
}

export const PropertyResultsCarousel: React.FC<PropertyResultsCarouselProps> = ({
  title,
  properties,
  onAnalyze,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const { toast } = useToast();
  const { hasAccess, tier } = useSubscription();
  const MAX_VISIBLE = 12;
  const visibleProperties = expanded ? properties : properties.slice(0, MAX_VISIBLE);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const hasPriceFairnessAccess = hasAccess('INVESTMENT_SCORE');

  // Calculate price fairness and enrichment for properties
  const enrichedProperties = useMemo(() => {
    return properties.map(property => {
      let priceFairness = null;
      let priceFairnessScore = null;

      if (property.price && property.sqft && hasPriceFairnessAccess) {
        const result = calculatePriceFairness(
          { price: property.price, sqft: property.sqft },
          properties
            .filter(p => p.price && p.sqft)
            .map(p => ({ price: p.price!, sqft: p.sqft! }))
        );
        
        if (result) {
          const fairnessMap: Record<string, "great" | "good" | "fair" | "overpriced"> = {
            very_underpriced: "great",
            underpriced: "good",
            fair: "fair",
            overpriced: "overpriced",
            very_overpriced: "overpriced",
          };
          priceFairness = fairnessMap[result.level];
          priceFairnessScore = result.percentageDiff;
        }
      }

      // Extract insights from property data
      const estRentMonthly = property.insights?.rentcast?.rent_estimate || null;
      const estValue = property.insights?.rentcast?.value_estimate || null;
      const rentToPriceRatio = estRentMonthly && property.price 
        ? (estRentMonthly * 12) / property.price 
        : null;

      return {
        property,
        insights: {
          estRentMonthly,
          estValue,
          rentToPriceRatio,
          capRate: null, // Can be calculated if we have more data
          cashflowHint: null,
          priceFairness,
          priceFairnessScore,
          marketSnapshotSummary: property.insights?.rentcast?.zip_market_summary?.trend_label || null,
        },
      };
    });
  }, [properties, hasPriceFairnessAccess]);

  // Initialize map
  useEffect(() => {
    if (viewMode === "map" && mapContainer.current && !map.current) {
      const initializeMap = async () => {
        try {
          const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');
          
          if (tokenError || !tokenData?.token) {
            console.error('Failed to fetch Mapbox token:', tokenError);
            toast({
              title: "Map unavailable",
              description: "Could not load map. Please try again later.",
              variant: "destructive",
            });
            return;
          }

          mapboxgl.accessToken = tokenData.token;

          const propertiesWithCoords = properties.filter(p => p.lat && p.lng);
          
          if (propertiesWithCoords.length === 0) {
            return;
          }

          // Calculate center from properties
          const avgLat = propertiesWithCoords.reduce((sum, p) => sum + (p.lat || 0), 0) / propertiesWithCoords.length;
          const avgLng = propertiesWithCoords.reduce((sum, p) => sum + (p.lng || 0), 0) / propertiesWithCoords.length;

          map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [avgLng, avgLat],
            zoom: 11,
          });

          map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

          // Add markers for each property
          propertiesWithCoords.forEach((property) => {
            if (!property.lat || !property.lng || !map.current) return;

            const el = document.createElement('div');
            el.className = 'property-marker';
            el.style.backgroundImage = 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
            el.style.width = '25px';
            el.style.height = '41px';
            el.style.backgroundSize = 'cover';
            el.style.cursor = 'pointer';

            const popupDiv = document.createElement('div');
            popupDiv.style.padding = '8px';
            popupDiv.style.minWidth = '200px';
            popupDiv.innerHTML = `
              <p style="font-weight: bold; margin-bottom: 4px;">${formatCurrency(property.price || 0)}</p>
              <p style="font-size: 12px; margin-bottom: 4px;">${property.address}</p>
              <p style="font-size: 11px; color: #666; margin-bottom: 8px;">${property.beds || 0} bed • ${property.baths || 0} bath • ${property.sqft?.toLocaleString() || 0} sqft</p>
              <button 
                id="analyze-btn-${property.id}"
                style="
                  width: 100%;
                  padding: 6px 12px;
                  background: hsl(var(--primary));
                  color: white;
                  border: none;
                  border-radius: 6px;
                  font-size: 12px;
                  font-weight: 500;
                  cursor: pointer;
                  transition: opacity 0.2s;
                "
                onmouseover="this.style.opacity='0.9'"
                onmouseout="this.style.opacity='1'"
              >
                Analyze Property
              </button>
            `;

            const popup = new mapboxgl.Popup({ offset: 25 })
              .setDOMContent(popupDiv);

            popup.on('open', () => {
              const analyzeBtn = document.getElementById(`analyze-btn-${property.id}`);
              if (analyzeBtn && onAnalyze) {
                analyzeBtn.addEventListener('click', () => {
                  onAnalyze(property);
                  popup.remove();
                });
              }
            });

            new mapboxgl.Marker(el)
              .setLngLat([property.lng, property.lat])
              .setPopup(popup)
              .addTo(map.current!);
          });
        } catch (error) {
          console.error('Error initializing map:', error);
          toast({
            title: "Map error",
            description: "Failed to initialize map. Please try again.",
            variant: "destructive",
          });
        }
      };
      
      initializeMap();
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [viewMode, properties, onAnalyze, toast]);

  const propertiesWithCoords = properties.filter(p => p.lat && p.lng);

  return (
    <div className="w-full mb-6" role="region" aria-label="Property search results">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{title}</h3>
          <span className="text-sm text-muted-foreground">({properties.length} results)</span>
        </div>
        
        {/* List/Map Toggle */}
        <div className="flex items-center gap-2 border rounded-lg p-1 bg-muted/30">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-9 px-4"
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
          <Button
            variant={viewMode === "map" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("map")}
            className="h-9 px-4"
            disabled={propertiesWithCoords.length === 0}
          >
            <MapIcon className="h-4 w-4 mr-2" />
            Map
          </Button>
        </div>
      </div>

      {viewMode === "map" ? (
        <div className="relative">
          {propertiesWithCoords.length === 0 ? (
            <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">No location data available for these properties</p>
            </div>
          ) : (
            <div ref={mapContainer} className="w-full h-96 rounded-lg" />
          )}
        </div>
      ) : (
        <>
          {/* Grid layout */}
          <div className="grid gap-5 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProperties.map((property) => {
              const enriched = enrichedProperties.find(e => e.property.id === property.id);
              return (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onAnalyze={onAnalyze}
                  insights={enriched?.insights}
                  showProLockedBadges={!hasPriceFairnessAccess}
                />
              );
            })}
          </div>

          {/* Show more button */}
          {!expanded && properties.length > MAX_VISIBLE && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => setExpanded(true)}
              >
                Show {properties.length - MAX_VISIBLE} more properties
              </Button>
            </div>
          )}
        </>
      )}

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
      />
    </div>
  );
};
