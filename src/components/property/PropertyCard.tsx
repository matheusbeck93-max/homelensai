import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Ruler, TrendingUp, ExternalLink, Heart, Share2, Bell, Lock } from "lucide-react";
import { HomeLensListing } from "@/types/ui-blocks";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { getFairnessLabel, getFairnessColor, type FairnessLevel } from "@/lib/pricingUtils";

interface PropertyCardInsights {
  estRentMonthly?: number | null;
  estValue?: number | null;
  rentToPriceRatio?: number | null;
  capRate?: number | null;
  cashflowHint?: "cashflow_positive" | "neutral" | "negative" | null;
  priceFairness?: "great" | "good" | "fair" | "overpriced" | null;
  priceFairnessScore?: number | null;
  marketSnapshotSummary?: string | null;
}

interface PropertyCardProps {
  property: HomeLensListing;
  onAnalyze?: (property: HomeLensListing) => void;
  onViewDetails?: (property: HomeLensListing) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (propertyId: string) => void;
  isWatched?: boolean;
  onToggleAlert?: (propertyId: string) => void;
  insights?: PropertyCardInsights;
  showProLockedBadges?: boolean;
}

export function PropertyCard({
  property,
  onAnalyze,
  onViewDetails,
  isFavorite: propIsFavorite,
  onToggleFavorite,
  isWatched: propIsWatched,
  onToggleAlert,
  insights,
  showProLockedBadges = true,
}: PropertyCardProps) {
  const { toast } = useToast();
  const { tier, userId } = useSubscription();
  const [isFavorite, setIsFavorite] = useState(propIsFavorite ?? false);
  const [isWatched, setIsWatched] = useState(propIsWatched ?? false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (propIsFavorite !== undefined) {
      setIsFavorite(propIsFavorite);
    } else if (userId) {
      checkFavorite();
    }
  }, [propIsFavorite, userId, property.id]);

  const checkFavorite = async () => {
    if (!userId) return;
    
    const { data } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("property_id", property.id)
      .single();

    setIsFavorite(!!data);
  };

  const handleToggleFavorite = async () => {
    if (onToggleFavorite) {
      onToggleFavorite(property.id);
      setIsFavorite(!isFavorite);
      return;
    }

    if (!userId) {
      toast({
        title: "Login required",
        description: "Please sign in to save favorites",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("property_id", property.id);

        if (error) throw error;

        setIsFavorite(false);
        toast({
          title: "Removed from favorites",
        });
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: userId, property_id: property.id });

        if (error) throw error;

        setIsFavorite(true);
        toast({
          title: "Added to favorites",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAlert = () => {
    if (onToggleAlert) {
      onToggleAlert(property.id);
      setIsWatched(!isWatched);
      toast({
        title: isWatched ? "Alert disabled" : "Alert enabled",
        description: isWatched 
          ? "You'll no longer receive updates for this property" 
          : "You'll be notified of price changes and status updates",
      });
    }
  };

  const handleShare = async () => {
    const url = property.listingUrl ?? window.location.href;
    const title = property.address;
    const text = `Check out this home: ${property.address} - ${formatPrice(property.price ?? 0)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        // User cancelled - ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied",
        description: "Property link copied to clipboard",
      });
    }
  };

  const formatPrice = (price: number | null) => {
    if (!price) return 'Price not available';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const imageUrl = property.photoUrl || '/placeholder.svg';
  const location = [property.city, property.state].filter(Boolean).join(', ') || 'Location not specified';
  const isPro = tier === 'pro' || tier === 'premium';

  // Calculate rent-to-price ratio if we have rent estimate
  const rentToPriceRatio = insights?.rentToPriceRatio || 
    (insights?.estRentMonthly && property.price 
      ? (insights.estRentMonthly * 12) / property.price 
      : null);

  const getRentYieldBadge = () => {
    if (!rentToPriceRatio) return null;
    
    if (rentToPriceRatio >= 0.08) {
      return { label: "Strong rent yield", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" };
    } else if (rentToPriceRatio >= 0.06) {
      return { label: "Good income potential", color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" };
    } else {
      return { label: "Lower yield area", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" };
    }
  };

  const getPriceFairnessBadge = () => {
    if (!insights?.priceFairness) return null;

    const fairnessMap: Record<string, FairnessLevel> = {
      great: 'very_underpriced',
      good: 'underpriced',
      fair: 'fair',
      overpriced: 'overpriced',
    };

    const level = fairnessMap[insights.priceFairness] || 'fair';
    const label = getFairnessLabel(level);
    const colors = getFairnessColor(level);

    return { label, colors, score: insights.priceFairnessScore };
  };

  const rentYieldBadge = getRentYieldBadge();
  const priceFairnessBadge = getPriceFairnessBadge();

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
          onClick={() => onViewDetails ? onViewDetails(property) : window.open(property.listingUrl || '#', '_blank')}
        />
        
        {/* Top-left badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {property.status && (
            <Badge className="bg-primary text-primary-foreground">
              {property.status}
            </Badge>
          )}
          {priceFairnessBadge && (
            <Badge className={`${priceFairnessBadge.colors.bg} ${priceFairnessBadge.colors.text} ${priceFairnessBadge.colors.border} border`}>
              {priceFairnessBadge.label}
              {isPro && priceFairnessBadge.score && (
                <span className="ml-1">({priceFairnessBadge.score > 0 ? '+' : ''}{priceFairnessBadge.score.toFixed(1)}%)</span>
              )}
              {!isPro && showProLockedBadges && (
                <Lock className="h-3 w-3 ml-1 inline" />
              )}
            </Badge>
          )}
          {rentYieldBadge && (
            <Badge className={`${rentYieldBadge.color} border`}>
              {rentYieldBadge.label}
              {isPro && rentToPriceRatio && (
                <span className="ml-1">({(rentToPriceRatio * 100).toFixed(1)}%)</span>
              )}
              {!isPro && showProLockedBadges && (
                <Lock className="h-3 w-3 ml-1 inline" />
              )}
            </Badge>
          )}
        </div>

        {/* Top-right actions */}
        <div className="absolute top-2 right-2 flex gap-1">
          {onToggleAlert && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleAlert}
              className="bg-background/80 backdrop-blur-sm hover:bg-background h-8 w-8 p-0"
            >
              <Bell className={`h-4 w-4 ${isWatched ? "fill-primary text-primary" : ""}`} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="bg-background/80 backdrop-blur-sm hover:bg-background h-8 w-8 p-0"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleFavorite}
            disabled={loading}
            className="bg-background/80 backdrop-blur-sm hover:bg-background h-8 w-8 p-0"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
          </Button>
        </div>
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

      <CardContent className="pb-4 flex-grow space-y-3">
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
            <span className="truncate">{property.sqft ? formatNumber(property.sqft) : '—'} sqft</span>
          </div>
        </div>

        {/* Investment insights (Pro) */}
        {insights?.estRentMonthly && (
          <div className="pt-3 border-t space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Est. Monthly Rent:</span>
              {isPro ? (
                <span className="font-semibold">{formatPrice(insights.estRentMonthly)}</span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Pro
                </span>
              )}
            </div>
            {isPro && insights.estValue && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Est. Market Value:</span>
                <span className="font-semibold">{formatPrice(insights.estValue)}</span>
              </div>
            )}
            {isPro && insights.capRate && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cap Rate:</span>
                <span className="font-semibold flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {(insights.capRate * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}
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
