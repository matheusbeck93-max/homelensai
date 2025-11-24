import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Ruler, TrendingUp, Scale } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { supabase } from "@/integrations/supabase/client";
import { PropertyInsights } from "@/components/PropertyInsights";
import { useComparison } from "@/contexts/ComparisonContext";
import { useToast } from "@/hooks/use-toast";

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
    status?: string;
    insights?: {
      rentcast?: {
        rent_estimate?: number | null;
        rent_low?: number | null;
        rent_high?: number | null;
        value_estimate?: number | null;
        confidence?: string | null;
        zip_market_summary?: {
          median_rent?: number | null;
          median_home_value?: number | null;
          rent_to_price_ratio?: number | null;
          trend_label?: string | null;
        } | null;
      };
      census?: {
        median_household_income?: number | null;
        owner_occupied_rate?: number | null;
        renter_occupied_rate?: number | null;
        median_age?: number | null;
        average_household_size?: number | null;
      };
    };
  };
}

export function PropertyCard({ property }: PropertyCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToComparison, isInComparison } = useComparison();
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);
  
  const handleAddToCompare = () => {
    addToComparison({
      id: property.id,
      address: property.address,
      city: property.city,
      state: property.state,
      price: property.price,
      beds: property.beds,
      baths: property.baths,
      sqft: property.sqft,
      photoUrl: property.image_urls[0] || null,
      insights: property.insights,
      zip: null,
      listingUrl: null,
      status: property.status || null,
      source: "realty_in_us",
    });
    toast({
      title: "Added to comparison",
      description: "Property added to comparison list",
    });
  };
  
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
        {property.insights && (
          <div className="mt-4 pt-4 border-t">
            <PropertyInsights insights={property.insights} compact />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        <Button 
          className="w-full" 
          variant="outline"
          onClick={() => navigate(`/property/${property.id}`)}
        >
          View Details
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="icon"
          onClick={handleAddToCompare}
          disabled={isInComparison(property.id)}
        >
          <Scale className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
