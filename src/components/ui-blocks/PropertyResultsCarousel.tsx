import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Bed, Bath, Square, ExternalLink, TrendingUp } from "lucide-react";
import { HomeLensListing } from "@/types/ui-blocks";
import { formatCurrency } from "@/lib/calculations";

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
  return (
    <div className="w-full mb-6" role="region" aria-label="Property search results">
      <div className="flex items-center gap-2 mb-4">
        <Home className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-sm text-muted-foreground">({properties.length} results)</span>
      </div>

      {/* Horizontal scrolling container */}
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted scrollbar-track-background touch-pan-x">
          {properties.map((property) => (
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

      {/* Attribution */}
      <div className="mt-2 text-xs text-muted-foreground text-center">
        Data provided by Realty in US via RapidAPI
      </div>
    </div>
  );
};
