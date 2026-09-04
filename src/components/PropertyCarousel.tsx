import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Home, Bed, Bath, Square } from "lucide-react";
import { PropertyInsights } from "@/components/PropertyInsights";
import { HomeLensListing } from "@/types/ui-blocks";

interface Property {
  id: string;
  address: string;
  city?: string | null;
  state?: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photoUrl: string | null;
  listingUrl?: string | null;
  description?: string;
  status?: string | null;
  insights?: HomeLensListing['insights'];
}

interface PropertyCarouselProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}

export default function PropertyCarousel({ properties, onSelectProperty }: PropertyCarouselProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="w-full max-w-full mx-auto py-4">
      <div className="flex items-center gap-2 mb-4 px-2">
        <Home className="h-5 w-5 text-primary" />
        <h3 className="text-base sm:text-lg font-semibold">Property Search Results</h3>
      </div>
      <Carousel className="w-full">
        <CarouselContent className="-ml-2 sm:-ml-4">
          {properties.map((property) => (
            <CarouselItem key={property.id} className="pl-2 sm:pl-4 basis-[85%] sm:basis-1/2 lg:basis-1/3">
              <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow w-full max-w-full">
                <div onClick={() => onSelectProperty(property)}>
                  <div className="aspect-video relative overflow-hidden bg-muted">
                    {property.photoUrl ? (
                      <img
                        src={property.photoUrl}
                        alt={property.address}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="h-16 w-16 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    {property.price && (
                      <p className="text-2xl font-bold text-primary mb-2">
                        {formatPrice(property.price)}
                      </p>
                    )}
                    <p className="text-sm font-medium mb-2 line-clamp-1">
                      {property.address}
                    </p>
                    {(property.city || property.state) && (
                      <p className="text-xs text-muted-foreground mb-3">
                        {property.city}{property.city && property.state ? ', ' : ''}{property.state}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      {property.beds !== null && (
                        <div className="flex items-center gap-1">
                          <Bed className="h-4 w-4" />
                          <span>{property.beds} beds</span>
                        </div>
                      )}
                      {property.baths !== null && (
                        <div className="flex items-center gap-1">
                          <Bath className="h-4 w-4" />
                          <span>{property.baths} baths</span>
                        </div>
                      )}
                      {property.sqft !== null && (
                        <div className="flex items-center gap-1">
                          <Square className="h-4 w-4" />
                          <span>{property.sqft} sqft</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Property Insights */}
                    {property.insights && (
                      <div className="mt-3 pt-3 border-t">
                        <PropertyInsights insights={property.insights} compact />
                      </div>
                    )}
                    
                    {property.description && (
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                        {property.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <Button 
                    onClick={() => onSelectProperty(property)}
                    className="w-full"
                    variant="outline"
                  >
                    Analyze This Property
                  </Button>
                </div>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}
