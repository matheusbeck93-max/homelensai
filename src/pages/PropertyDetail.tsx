import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Bed, Bath, Ruler, DollarSign, TrendingUp, Sparkles, Map as MapIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { ExternalLinks } from "@/components/ExternalLinks";
import { NeighborhoodInsights } from "@/components/NeighborhoodInsights";
import { NeighborhoodPersonality } from "@/components/NeighborhoodPersonality";
import { PropertyMap } from "@/components/PropertyMap";
import { PropertyPDFExport } from "@/components/PropertyPDFExport";
import { NeighborhoodInsights as NeighborhoodInsightsType } from "@/types/neighborhood";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { PropertyInsights } from "@/components/PropertyInsights";
import { MarketTrendsChart } from "@/components/MarketTrendsChart";
import { useBudgetCap, parseAndRecordBudget402 } from "@/lib/ai/budgetCap";
import { BudgetCapBanner } from "@/components/ai/BudgetCapBanner";
import { BudgetCapBlocker } from "@/components/ai/BudgetCapBlocker";

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPremium } = useSubscription();
  const cap = useBudgetCap();
  const isCapExceeded = cap.warningLevel === "exceeded";
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [userId, setUserId] = useState<string | undefined>();
  const [neighborhoodInsights, setNeighborhoodInsights] = useState<NeighborhoodInsightsType | null>(null);
  const [neighborhoodPersonality, setNeighborhoodPersonality] = useState<string>("");
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsSource, setInsightsSource] = useState<'perplexity' | 'fallback'>('fallback');
  const [showMap, setShowMap] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProperty();
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, [id]);

  const fetchNeighborhoodInsights = async (forceRefresh = false) => {
    if (!property) return;

    setLoadingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke("neighborhood-insights", {
        body: {
          address: property.address,
          city: property.city,
          state: property.state,
          zip: property.zip,
        },
      });

      if (error) throw error;

      if (data?.insights) {
        setNeighborhoodInsights(data.insights);
        setInsightsSource(data.source || 'fallback');
        if (forceRefresh) {
          toast({
            title: "Neighborhood data refreshed",
            description: data.source === 'perplexity' ? "AI-powered insights updated" : "Data updated",
          });
        }
      }
    } catch (error: any) {
      console.error('Error fetching neighborhood insights:', error);
      toast({
        title: "Could not load neighborhood data",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    if (property && !neighborhoodInsights && !loadingInsights) {
      fetchNeighborhoodInsights();
    }
  }, [property]);

  const handleMapToggle = () => {
    setShowMap(!showMap);
  };

  const fetchProperty = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setProperty(data);
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

  const handleAnalyze = async () => {
    setAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("ai-analyze", {
        body: { property },
      });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (error: any) {
      const wasCap = await parseAndRecordBudget402(error, "property_ai_analysis");
      if (wasCap) { setAnalyzing(false); return; }
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <Skeleton className="h-96 w-full mb-8" />
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Property not found</h1>
          <Button onClick={() => navigate("/")}>
            Back to Properties
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {property && (() => {
        const priceStr = property.price ? `$${Number(property.price).toLocaleString()}` : "";
        const addr = [property.address, property.city, property.state].filter(Boolean).join(", ");
        const rawTitle = `${addr}${priceStr ? ` — ${priceStr}` : ""} | HomeLens`;
        const title = rawTitle.length > 60 ? `${addr.slice(0, 50)} | HomeLens` : rawTitle;
        const beds = property.bedrooms ? `${property.bedrooms} bd` : "";
        const baths = property.bathrooms ? `${property.bathrooms} ba` : "";
        const sqft = property.living_area ? `${Number(property.living_area).toLocaleString()} sqft` : "";
        const specs = [beds, baths, sqft].filter(Boolean).join(" · ");
        const desc = `${addr}${priceStr ? ` listed at ${priceStr}` : ""}${specs ? `. ${specs}` : ""}. AI investment analysis, neighborhood data, and market insights on HomeLens.`;
        const url = `https://homelensais.com/property/${id}`;
        return (
          <Helmet>
            <title>{title}</title>
            <meta name="description" content={desc.slice(0, 160)} />
            <link rel="canonical" href={url} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={desc.slice(0, 160)} />
            <meta property="og:url" content={url} />
            <meta property="og:type" content="article" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={desc.slice(0, 160)} />
          </Helmet>
        );
      })()}
      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Properties
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <img
              src={property.image_urls[0] || '/placeholder.svg'}
              alt={property.address}
              className="w-full h-96 object-cover rounded-lg shadow-lg"
            />
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-primary mb-2">
                {formatPrice(property.price)}
              </h1>
              <p className="flex items-center gap-2 text-lg text-muted-foreground">
                <MapPin className="h-5 w-5" />
                {property.address}, {property.city}, {property.state} {property.zip}
              </p>
            </div>

            <div className="flex gap-6 text-lg">
              <div className="flex items-center gap-2">
                <Bed className="h-5 w-5 text-muted-foreground" />
                <span>{property.beds} Beds</span>
              </div>
              <div className="flex items-center gap-2">
                <Bath className="h-5 w-5 text-muted-foreground" />
                <span>{property.baths} Baths</span>
              </div>
              <div className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-muted-foreground" />
                <span>{property.sqft} sqft</span>
              </div>
            </div>

            <Badge className="text-lg px-4 py-2">
              {property.condition}
            </Badge>

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle>Investment Analysis</CardTitle>
                <CardDescription>Key metrics for this property</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {property.arv && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">After Repair Value (ARV)</span>
                    <span className="font-semibold">{formatPrice(property.arv)}</span>
                  </div>
                )}
                {property.rehab_cost && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Estimated Rehab Cost</span>
                    <span className="font-semibold">{formatPrice(property.rehab_cost)}</span>
                  </div>
                )}
                {property.roi_percent && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Estimated ROI
                    </span>
                    <span className="font-semibold text-secondary text-lg">
                      {property.roi_percent}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button 
              className="w-full" 
              size="lg"
              onClick={handleAnalyze}
              disabled={analyzing || isCapExceeded}
            >
              {analyzing ? (
                <>
                  <Sparkles className="mr-2 h-5 w-5 animate-pulse" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate AI Analysis
                </>
              )}
            </Button>
            {cap.warningLevel === "approaching" && (
              <div className="flex justify-center">
                <BudgetCapBanner surface="property_ai_analysis" />
              </div>
            )}
            {isCapExceeded && (
              <BudgetCapBlocker surface="property_ai_analysis" compact />
            )}

            

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleMapToggle}
            >
              {showMap ? (
                <>
                  <MapIcon className="mr-2 h-5 w-5" />
                  Hide Map
                </>
              ) : (
                <>
                  <MapIcon className="mr-2 h-5 w-5" />
                  View on Map
                </>
              )}
            </Button>

            <PropertyPDFExport 
              property={property}
              analysis={analysis}
              neighborhoodPersonality={neighborhoodPersonality}
            />

            {analysis && (
              <Card>
                <CardHeader>
                  <CardTitle>AI Analysis Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{analysis}</p>
                </CardContent>
              </Card>
            )}

            <ExternalLinks property={property} />
          </div>
        </div>

        {/* Property Insights from RentCast & Census */}
        {property.insights && (
          <div className="mt-8">
            <PropertyInsights insights={property.insights} />
          </div>
        )}

        {property.description && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Property Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{property.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Interactive Map */}
        {showMap && (
          <div className="mt-8">
            <PropertyMap
              address={property.address}
              city={property.city}
              state={property.state}
              zip={property.zip}
              insights={neighborhoodInsights || undefined}
            />
          </div>
        )}

        {/* Market Trends Chart */}
        <div className="mt-8">
          <MarketTrendsChart location={`${property.city}, ${property.state} ${property.zip}`} />
        </div>

        {/* Neighborhood Personality AI */}
        <div className="mt-8">
          <NeighborhoodPersonality
            address={property.address}
            city={property.city}
            state={property.state}
            zip={property.zip}
            onPersonalityGenerated={setNeighborhoodPersonality}
          />
        </div>

        {/* Neighborhood Insights */}
        <div className="mt-8">
          {loadingInsights ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : neighborhoodInsights ? (
            <NeighborhoodInsights 
              insights={neighborhoodInsights} 
              isLoading={loadingInsights}
              onRefresh={() => fetchNeighborhoodInsights(true)}
              source={insightsSource}
            />
          ) : null}
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="This is a Premium feature"
        feature="Upgrade to unlock the full HomeLens experience"
      />
    </div>
  );
}
