import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Ruler, ExternalLink } from "lucide-react";
import { HomeLensListing } from "@/types/ui-blocks";
import { FavoriteButton } from "./FavoriteButton";
import { ShareButton } from "./ShareButton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeaturedPropertyCardProps {
  property: HomeLensListing;
  onAnalyze?: (property: HomeLensListing) => void;
}

export function FeaturedPropertyCard({ property, onAnalyze }: FeaturedPropertyCardProps) {
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);

  const formatPrice = (price: number | null) => {
    if (!price) return 'Price not available';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const imageUrl = property.photoUrl || '/placeholder.svg';
  const location = [property.city, property.state].filter(Boolean).join(', ') || 'Location not specified';

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
      <div className="relative h-56 overflow-hidden cursor-pointer group">
        <img
          src={imageUrl}
          alt={property.address}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.svg';
          }}
        />
        <ShareButton property={property} />
        <FavoriteButton propertyId={property.id} userId={userId} variant="icon" />
        {property.status && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium">
            {property.status}
          </div>
        )}
      </div>
      
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold text-primary">
          {formatPrice(property.price)}
        </CardTitle>
        <CardDescription className="flex items-start gap-1 line-clamp-2">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{property.address}, {location}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-4 flex-grow">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <Bed className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{property.beds || '—'} beds</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{property.baths || '—'} baths</span>
          </div>
          <div className="flex items-center gap-1">
            <Ruler className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{property.sqft ? `${property.sqft.toLocaleString()}` : '—'} sqft</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        {property.listingUrl && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            asChild
          >
            <a href={property.listingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              View
            </a>
          </Button>
        )}
        {onAnalyze && (
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => onAnalyze(property)}
          >
            Analyze
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
