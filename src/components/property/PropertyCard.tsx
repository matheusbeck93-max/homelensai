import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Bed, Bath, Ruler, TrendingUp, ExternalLink, Share2, Bell, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { HomeLensListing } from "@/types/ui-blocks";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useComparison } from "@/contexts/ComparisonContext";
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
  isWatched?: boolean;
  onToggleAlert?: (propertyId: string) => void;
  insights?: PropertyCardInsights;
  showProLockedBadges?: boolean;
}

export function PropertyCard({
  property,
  onAnalyze,
  onViewDetails,
  isWatched: propIsWatched,
  onToggleAlert,
  insights,
  showProLockedBadges = true,
}: PropertyCardProps) {
  const { toast } = useToast();
  const { tier, userId } = useSubscription();
  const { addToComparison, removeFromComparison, isSelected, canAddMore } = useComparison();
  const [isWatched, setIsWatched] = useState(propIsWatched ?? false);
  const [loading, setLoading] = useState(false);
  
  const isComparisonSelected = isSelected(property.id);

  useEffect(() => {
    if (propIsWatched !== undefined) {
      setIsWatched(propIsWatched);
    }
  }, [propIsWatched]);


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

  const handleComparisonToggle = (checked: boolean) => {
    if (checked) {
      if (!canAddMore) {
        return; // toast handled by context
      }
      addToComparison(property);
    } else {
      removeFromComparison(property.id);
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

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined || isNaN(num)) {
      return '—';
    }
    return new Intl.NumberFormat('en-US').format(num);
  };

  const imageUrl = property.photoUrl || '/placeholder.svg';
  const location = [property.city, property.state].filter(Boolean).join(', ') || 'Location not specified';
  const isPremium = tier !== 'free';

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
    // Use property's built-in fairness data from Zillow as primary source
    if (property.fairPriceLevel && property.zestimate) {
      const label = getFairnessLabel(property.fairPriceLevel as FairnessLevel);
      const colors = getFairnessColor(property.fairPriceLevel as FairnessLevel);
      const percentDiff = property.price && property.zestimate 
        ? ((property.price - property.zestimate) / property.zestimate) * 100 
        : null;
      return { label, colors, score: percentDiff };
    }

    // Fallback to insights if available
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

  // Handle multiple images
  const images = property.photos && property.photos.length > 0 
    ? property.photos 
    : [property.photoUrl || '/placeholder.svg'];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };
  
  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
      <div className="relative h-56 overflow-hidden group">
        {property.listingUrl ? (
          <a
            href={property.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-full cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[currentImageIndex]}
              alt={`${property.address} - Image ${currentImageIndex + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }}
            />
          </a>
        ) : (
          <img
            src={images[currentImageIndex]}
            alt={`${property.address} - Image ${currentImageIndex + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
        )}
        
        {/* Image navigation arrows - only show if multiple images */}
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            {/* Image counter */}
            <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md text-xs">
              {currentImageIndex + 1} / {images.length}
            </div>
          </>
        )}
        
        {/* Bottom-left badges */}
        <div className="absolute bottom-2 left-2 flex flex-col gap-1">
          {property.status && (
            <Badge className="bg-primary text-primary-foreground">
              {property.status}
            </Badge>
          )}
          {priceFairnessBadge && (
            <Badge className={`${priceFairnessBadge.colors.bg} ${priceFairnessBadge.colors.text} ${priceFairnessBadge.colors.border} border`}>
              {priceFairnessBadge.label}
              {isPremium && priceFairnessBadge.score && (
                <span className="ml-1">({priceFairnessBadge.score > 0 ? '+' : ''}{priceFairnessBadge.score.toFixed(1)}%)</span>
              )}
              {!isPremium && showProLockedBadges && (
                <Lock className="h-3 w-3 ml-1 inline" />
              )}
            </Badge>
          )}
          {rentYieldBadge && (
            <Badge className={`${rentYieldBadge.color} border`}>
              {rentYieldBadge.label}
              {isPremium && rentToPriceRatio && (
                <span className="ml-1">({(rentToPriceRatio * 100).toFixed(1)}%)</span>
              )}
              {!isPremium && showProLockedBadges && (
                <Lock className="h-3 w-3 ml-1 inline" />
              )}
            </Badge>
          )}
        </div>

        {/* Comparison checkbox - Top left corner */}
        <div className="absolute top-2 left-2 z-10">
          <div 
            className="flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-md px-2 py-1.5 shadow-sm border border-border/50 cursor-pointer hover:bg-background transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleComparisonToggle(!isComparisonSelected);
            }}
          >
            <Checkbox
              checked={isComparisonSelected}
              onCheckedChange={handleComparisonToggle}
              disabled={!canAddMore && !isComparisonSelected}
              className="h-4 w-4"
            />
            <span className="text-xs font-medium">Compare</span>
          </div>
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

        {/* Investment insights (Premium) */}
        {insights?.estRentMonthly && (
          <div className="pt-3 border-t space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Est. Monthly Rent:</span>
              {isPremium ? (
                <span className="font-semibold">{formatPrice(insights.estRentMonthly)}</span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Premium
                </span>
              )}
            </div>
            {isPremium && insights.estValue && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Est. Market Value:</span>
                <span className="font-semibold">{formatPrice(insights.estValue)}</span>
              </div>
            )}
            {isPremium && insights.capRate && (
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
