import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Bed, Bath, Square, ExternalLink, TrendingUp, List, Map as MapIcon, Heart } from "lucide-react";
import { HomeLensListing } from "@/types/ui-blocks";
import { formatCurrency } from "@/lib/calculations";
import { ShareMenu } from "@/components/ShareMenu";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useToast } from "@/hooks/use-toast";
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
  const { isFavorite, toggleFavorite } = useFavorites();
  const { toast } = useToast();
  const MAX_VISIBLE = 10;
  const visibleProperties = expanded ? properties : properties.slice(0, MAX_VISIBLE);
  const mapContainer = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<mapboxgl.Map | null>(null);

  const handleToggleFavorite = (e: React.MouseEvent, property: HomeLensListing) => {
    e.stopPropagation();
    e.preventDefault();
    const wasFavorite = isFavorite(property.id);
    toggleFavorite(property);
    toast({
      title: wasFavorite ? "Removed from favorites" : "Added to favorites",
      description: wasFavorite ? "Property removed from your favorites" : "Property saved to your favorites",
    });
  };

  // Initialize map when switching to map view
  React.useEffect(() => {
    if (viewMode === 'map' && mapContainer.current && !map.current) {
      // Use hardcoded Mapbox public token
      const token = 'pk.eyJ1IjoicGJlY2sxMyIsImEiOiJjbWliMjQzZHgxNHVwMmxvYXJyOWZxa3RsIn0.Vk9tWn1vghY9Vw6RRKLpaA';

      mapboxgl.accessToken = token;

      // Find properties with coordinates
      const propertiesWithCoords = properties.filter(p => p.lat && p.lng);
      
      if (propertiesWithCoords.length === 0) {
        return;
      }

      // Calculate center from properties
      const avgLat = propertiesWithCoords.reduce((sum, p) => sum + (p.lat || 0), 0) / propertiesWithCoords.length;
      const avgLng = propertiesWithCoords.reduce((sum, p) => sum + (p.lng || 0), 0) / propertiesWithCoords.length;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
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

        // Create popup container
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

        // Add click handler to the analyze button
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setDOMContent(popupDiv);

        // Wait for popup to open, then attach event listener
        popup.on('open', () => {
          const analyzeBtn = document.getElementById(`analyze-btn-${property.id}`);
          if (analyzeBtn && onAnalyze) {
            analyzeBtn.addEventListener('click', () => {
              onAnalyze(property);
              popup.remove(); // Close the popup after clicking
            });
          }
        });

        new mapboxgl.Marker(el)
          .setLngLat([property.lng, property.lat])
          .setPopup(popup)
          .addTo(map.current);
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [viewMode, properties]);

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
          {/* Horizontal scrolling container */}
          <div className="relative">
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted scrollbar-track-background touch-pan-x">
              {visibleProperties.map((property) => (
                <Card
                  key={property.id}
                  className="flex-shrink-0 w-[90vw] max-w-[320px] overflow-hidden hover:shadow-lg transition-shadow snap-start"
                >
                  {/* Property Image */}
                  <div className="aspect-video relative overflow-hidden bg-muted">
                    {property.photoUrl ? (
                      <img
                        src={property.photoUrl}
                        alt={property.address}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="h-16 w-16 text-muted-foreground/20" />
                      </div>
                    )}
                    {property.status && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-medium">
                        {property.status}
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <ShareMenu property={property}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="bg-background/80 backdrop-blur-sm hover:bg-background"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </ShareMenu>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background"
                      onClick={(e) => handleToggleFavorite(e, property)}
                      aria-label={isFavorite(property.id) ? "Remove from favorites" : "Save to favorites"}
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          isFavorite(property.id) ? "fill-red-500 text-red-500" : ""
                        }`}
                      />
                    </Button>
                  </div>

                  {/* Property Details */}
                  <div className="p-4 space-y-3">
                    {/* Price */}
                    {property.price && (
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(property.price)}
                      </p>
                    )}

                    {/* Address */}
                    <div className="min-h-[2.5rem]">
                      <p className="text-sm font-medium line-clamp-2">
                        {property.address}
                      </p>
                      {(property.city || property.state) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {property.city}{property.city && property.state ? ', ' : ''}{property.state}
                        </p>
                      )}
                    </div>

                    {/* Property Stats */}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {property.beds !== null && (
                        <div className="flex items-center gap-1">
                          <Bed className="h-4 w-4" />
                          <span>{property.beds}</span>
                        </div>
                      )}
                      {property.baths !== null && (
                        <div className="flex items-center gap-1">
                          <Bath className="h-4 w-4" />
                          <span>{property.baths}</span>
                        </div>
                      )}
                      {property.sqft !== null && (
                        <div className="flex items-center gap-1">
                          <Square className="h-4 w-4" />
                          <span>{property.sqft.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      {property.listingUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(property.listingUrl!, '_blank')}
                          aria-label={`View details for ${property.address}`}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      )}
                      {onAnalyze && (
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => onAnalyze(property)}
                          aria-label={`Analyze ${property.address}`}
                        >
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Analyze
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Show all button */}
          {properties.length > MAX_VISIBLE && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => setExpanded(prev => !prev)}
                className="min-w-[200px]"
              >
                {expanded ? (
                  <>
                    Show less
                  </>
                ) : (
                  <>
                    Show all {properties.length} properties
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Expanded grid view */}
          {expanded && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {properties.map((property) => (
                <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Property Image */}
                  <div className="aspect-video relative overflow-hidden bg-muted">
                    {property.photoUrl ? (
                      <img
                        src={property.photoUrl}
                        alt={property.address}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="h-16 w-16 text-muted-foreground/20" />
                      </div>
                    )}
                    {property.status && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-medium">
                        {property.status}
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <ShareMenu property={property}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="bg-background/80 backdrop-blur-sm hover:bg-background"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </ShareMenu>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background"
                      onClick={(e) => handleToggleFavorite(e, property)}
                      aria-label={isFavorite(property.id) ? "Remove from favorites" : "Save to favorites"}
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          isFavorite(property.id) ? "fill-red-500 text-red-500" : ""
                        }`}
                      />
                    </Button>
                  </div>

                  {/* Property Details */}
                  <div className="p-4 space-y-3">
                    {/* Price */}
                    {property.price && (
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(property.price)}
                      </p>
                    )}

                    {/* Address */}
                    <div className="min-h-[2.5rem]">
                      <p className="text-sm font-medium line-clamp-2">
                        {property.address}
                      </p>
                      {(property.city || property.state) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {property.city}{property.city && property.state ? ', ' : ''}{property.state}
                        </p>
                      )}
                    </div>

                    {/* Property Stats */}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {property.beds !== null && (
                        <div className="flex items-center gap-1">
                          <Bed className="h-4 w-4" />
                          <span>{property.beds}</span>
                        </div>
                      )}
                      {property.baths !== null && (
                        <div className="flex items-center gap-1">
                          <Bath className="h-4 w-4" />
                          <span>{property.baths}</span>
                        </div>
                      )}
                      {property.sqft !== null && (
                        <div className="flex items-center gap-1">
                          <Square className="h-4 w-4" />
                          <span>{property.sqft.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      {property.listingUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(property.listingUrl!, '_blank')}
                          aria-label={`View details for ${property.address}`}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      )}
                      {onAnalyze && (
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => onAnalyze(property)}
                          aria-label={`Analyze ${property.address}`}
                        >
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Analyze
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Attribution */}
      <div className="mt-2 text-xs text-muted-foreground text-center">
        Data provided by Realty in US via RapidAPI
      </div>
    </div>
  );
};
