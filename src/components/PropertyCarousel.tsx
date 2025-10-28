import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Home, Bed, Bath, Square } from "lucide-react";

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  image_url: string;
  description?: string;
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
    <div className="w-full max-w-4xl mx-auto py-4">
      <div className="flex items-center gap-2 mb-4">
        <Home className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Property Search Results</h3>
      </div>
      <Carousel className="w-full">
        <CarouselContent>
          {properties.map((property) => (
            <CarouselItem key={property.id} className="md:basis-1/2 lg:basis-1/3">
              <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
                <div onClick={() => onSelectProperty(property)}>
                  <div className="aspect-video relative overflow-hidden">
                    <img
                      src={property.image_url}
                      alt={property.address}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-2xl font-bold text-primary mb-2">
                      {formatPrice(property.price)}
                    </p>
                    <p className="text-sm font-medium mb-2 line-clamp-1">
                      {property.address}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {property.city}, {property.state}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        <span>{property.beds} beds</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bath className="h-4 w-4" />
                        <span>{property.baths} baths</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Square className="h-4 w-4" />
                        <span>{property.sqft} sqft</span>
                      </div>
                    </div>
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
