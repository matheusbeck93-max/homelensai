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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
        const listingJsonLd = {
          "@context": "https://schema.org",
          "@type": "RealEstateListing",
          "name": addr,
          "url": url,
          "description": desc.slice(0, 300),
          ...(property.image_urls?.[0] ? { "image": property.image_urls[0] } : {}),
          ...(property.price ? {
            "offers": {
              "@type": "Offer",
              "price": Number(property.price),
              "priceCurrency": "USD",
              "availability": "https://schema.org/InStock"
            }
          } : {}),
          "address": {
            "@type": "PostalAddress",
            ...(property.address ? { "streetAddress": property.address } : {}),
            ...(property.city ? { "addressLocality": property.city } : {}),
            ...(property.state ? { "addressRegion": property.state } : {}),
            ...(property.zip ? { "postalCode": String(property.zip) } : {}),
            "addressCountry": "US"
          },
          ...(property.bedrooms ? { "numberOfRooms": Number(property.bedrooms) } : {}),
          ...(property.living_area ? {
            "floorSize": { "@type": "QuantitativeValue", "value": Number(property.living_area), "unitCode": "FTK" }
          } : {})
        };
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
            <script type="application/ld+json">{JSON.stringify(listingJsonLd)}</script>
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
            {/* Header: price, address, specs */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <span className="text-primary">{formatPrice(property.price)}</span>
                <span className="block text-xl md:text-2xl font-semibold text-foreground mt-1">
                  {property.address}, {property.city}, {property.state} {property.zip}
                </span>
              </h1>
              <p className="flex items-center gap-2 text-lg text-muted-foreground">
                <MapPin className="h-5 w-5" />
                {property.city}, {property.state}
              </p>
            </div>

            <div className="flex flex-wrap gap-6 text-lg">
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
              {property.condition && (
                <Badge className="text-base px-3 py-1">
                  {property.condition}
                </Badge>
              )}
            </div>

            {/* 1. VERDICT — headline metrics + primary CTA to generate/refresh analysis */}
            <section aria-labelledby="verdict-heading">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Verdict</span>
                <Separator className="flex-1" />
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle as="h2" id="verdict-heading" className="text-lg">Investment Analysis</CardTitle>
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
                  {!property.arv && !property.rehab_cost && !property.roi_percent && (
                    <p className="text-sm text-muted-foreground">
                      No investment metrics on file yet. Generate an AI analysis to get a full verdict.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button
                className="w-full mt-3"
                size="lg"
                onClick={handleAnalyze}
                disabled={analyzing || isCapExceeded}
              >
                {analyzing ? (
                  <>
                    <Sparkles className="mr-2 h-5 w-5 animate-pulse" />
                    Analyzing...
                  </>
                ) : analysis ? (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Refresh AI Analysis
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate AI Analysis
                  </>
                )}
              </Button>
              {cap.warningLevel === "approaching" && (
                <div className="flex justify-center mt-2">
                  <BudgetCapBanner surface="property_ai_analysis" />
                </div>
              )}
              {isCapExceeded && (
                <BudgetCapBlocker surface="property_ai_analysis" compact />
              )}

              {/* Post-verdict agent actions — you decide, the agent just sets things up */}
              {analysis && (
                <AgentActionBar
                  className="mt-4"
                  seed={{
                    address: [property.address, property.city, property.state]
                      .filter(Boolean)
                      .join(", "),
                    price: property.price ? Number(property.price) : undefined,
                    city: property.city ?? undefined,
                    state: property.state ?? undefined,
                    beds: property.bedrooms ?? undefined,
                    baths: property.bathrooms ?? undefined,
                  }}
                />
              )}
            </section>


            {/* 2. WHY — AI rationale / key highlights */}
            <section aria-labelledby="why-heading">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Why</span>
                <Separator className="flex-1" />
              </div>
              {analysis ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle as="h2" id="why-heading" className="text-lg">AI Analysis Report</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{analysis}</p>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  Generate an analysis to see the AI rationale and key highlights behind the verdict.
                </p>
              )}
            </section>
          </div>
        </div>

        {/* 3. DIG DEEPER — collapsed, on-demand sections */}
        <section aria-labelledby="digdeeper-heading" className="mt-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary" id="digdeeper-heading">
              Dig deeper
            </span>
            <Separator className="flex-1" />
          </div>

          <Accordion
            type="single"
            collapsible
            value={showMap ? "map" : undefined}
            onValueChange={(v) => setShowMap(v === "map")}
          >
            {/* Property Insights (RentCast & Census) */}
            {property.insights && (
              <AccordionItem value="insights">
                <AccordionTrigger>Property Insights (RentCast & Census)</AccordionTrigger>
                <AccordionContent>
                  <PropertyInsights insights={property.insights} />
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Property Description */}
            {property.description && (
              <AccordionItem value="description">
                <AccordionTrigger>Property Description</AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">{property.description}</p>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Interactive Map */}
            <AccordionItem value="map">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <MapIcon className="h-4 w-4" />
                  View on Map
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {showMap && (
                  <PropertyMap
                    address={property.address}
                    city={property.city}
                    state={property.state}
                    zip={property.zip}
                    insights={neighborhoodInsights || undefined}
                  />
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Market Trends Chart */}
            <AccordionItem value="market">
              <AccordionTrigger>Market Trends</AccordionTrigger>
              <AccordionContent>
                <MarketTrendsChart location={`${property.city}, ${property.state} ${property.zip}`} />
              </AccordionContent>
            </AccordionItem>

            {/* Neighborhood Personality AI */}
            <AccordionItem value="personality">
              <AccordionTrigger>Neighborhood Personality (AI)</AccordionTrigger>
              <AccordionContent>
                <NeighborhoodPersonality
                  address={property.address}
                  city={property.city}
                  state={property.state}
                  zip={property.zip}
                  onPersonalityGenerated={setNeighborhoodPersonality}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Neighborhood Insights */}
            <AccordionItem value="neighborhood">
              <AccordionTrigger>Neighborhood Insights</AccordionTrigger>
              <AccordionContent>
                {loadingInsights ? (
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : neighborhoodInsights ? (
                  <NeighborhoodInsights
                    insights={neighborhoodInsights}
                    isLoading={loadingInsights}
                    onRefresh={() => fetchNeighborhoodInsights(true)}
                    source={insightsSource}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No neighborhood data available.</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* External Links */}
            <AccordionItem value="links">
              <AccordionTrigger>View on other sites</AccordionTrigger>
              <AccordionContent>
                <ExternalLinks property={property} />
              </AccordionContent>
            </AccordionItem>

            {/* PDF Export */}
            <AccordionItem value="pdf">
              <AccordionTrigger>Export PDF report</AccordionTrigger>
              <AccordionContent>
                <PropertyPDFExport
                  property={property}
                  analysis={analysis}
                  neighborhoodPersonality={neighborhoodPersonality}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
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
