import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Ruler, TrendingUp } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { supabase } from "@/integrations/supabase/client";

interface PropertyCardProps {
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    price: number;
    beds: number;
    baths: number;
    sqft: number;
    condition: string;
    image_urls: string[];
    roi_percent?: number;
  };
}

export function PropertyCard({ property }: PropertyCardProps) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getConditionColor = (condition: string) => {
    const colors: Record<string, string> = {
      excellent: "bg-secondary",
      good: "bg-primary",
      fair: "bg-accent",
      "needs work": "bg-muted-foreground",
      fixer: "bg-destructive",
    };
    return colors[condition] || "bg-muted";
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative h-48 overflow-hidden cursor-pointer" onClick={() => navigate(`/property/${property.id}`)}>
        <img
          src={property.image_urls[0] || '/placeholder.svg'}
          alt={property.address}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
        <Badge className={`absolute top-2 left-2 ${getConditionColor(property.condition)}`}>
          {property.condition}
        </Badge>
        <ShareButton property={property} />
        <FavoriteButton propertyId={property.id} userId={userId} variant="icon" />
      </div>
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-primary">
          {formatPrice(property.price)}
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          {property.address}, {property.city}, {property.state}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Bed className="h-4 w-4 text-muted-foreground" />
            <span>{property.beds} beds</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="h-4 w-4 text-muted-foreground" />
            <span>{property.baths} baths</span>
          </div>
          <div className="flex items-center gap-1">
            <Ruler className="h-4 w-4 text-muted-foreground" />
            <span>{property.sqft} sqft</span>
          </div>
        </div>
        {property.roi_percent && (
          <div className="flex items-center gap-1 mt-4 text-secondary font-semibold">
            <TrendingUp className="h-4 w-4" />
            <span>ROI: {property.roi_percent}%</span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="outline">
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
