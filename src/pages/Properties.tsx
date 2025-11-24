import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Bed, Bath, Square, MapPin } from "lucide-react";
import PropertyCarousel from "@/components/PropertyCarousel";
import FollowUpChat from "@/components/FollowUpChat";
// External link generation removed
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { EmptyState } from "@/components/EmptyState";
import { Search } from "lucide-react";

interface Property {
  id: string;
  address: string;
  city?: string | null;
  state?: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  image_urls?: string[];
  photoUrl?: string | null;
  image_url?: string;
  description?: string;
  externalLink?: string;
  listingUrl?: string | null;
  zip?: string;
  status?: string | null;
}

export default function Properties() {
  const [assistantResponse, setAssistantResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [marketSnapshot, setMarketSnapshot] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const handleSearch = useCallback(async (query: string, categories?: string[]) => {
    if (!query.trim()) return;
    
    setSearchLoading(true);
    setAssistantResponse("");
    setProperties([]);
    setSelectedProperty(null);
    
    try {
      // Search for properties using AI
      const { data: searchData, error: searchError } = await supabase.functions.invoke('ai-search', {
        body: { query, categories }
      });

      if (searchError) throw searchError;

      const foundProperties = searchData?.properties || [];
      
      if (foundProperties.length === 0) {
        toast({
          title: "No properties found",
          description: searchData?.message || "No properties match your search. Try adjusting your criteria.",
          variant: "default",
        });
        setSearchLoading(false);
        return;
      }
      
      // Add external links to all properties
      const propsToUse = foundProperties.map(prop => ({
        ...prop,
        externalLink: prop.externalLink || null
      }));
      
      setProperties(propsToUse);

      // Fetch market snapshot for the location
      const firstProperty = propsToUse[0];
      let snapshot = null;
      if (firstProperty?.zip || (firstProperty?.city && firstProperty?.state)) {
        try {
          const { data: snapshotData } = await supabase.functions.invoke('market-snapshot', {
            body: {
              location: {
                zip: firstProperty.zip,
                city: firstProperty.city,
                state: firstProperty.state
              }
            }
          });
          if (snapshotData?.snapshot) {
            snapshot = snapshotData.snapshot;
            setMarketSnapshot(snapshot);
          }
        } catch (error) {
          console.error('Market snapshot error:', error);
        }
      }

      // Get AI analysis of those properties
      const { data: assistantData, error: assistantError } = await supabase.functions.invoke('property-assistant', {
        body: { 
          query,
          categories,
          properties: propsToUse,
          marketSnapshot: snapshot || undefined
        }
      });

      if (assistantError) {
        console.error('Assistant error:', assistantError);
      } else {
        setAssistantResponse(assistantData?.response || "I found some properties for you!");
      }
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const query = searchParams.get('q');
    const categories = searchParams.get('categories');
    
    if (query) {
      handleSearch(query, categories?.split(','));
    }
  }, [searchParams, handleSearch]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handlePropertySelect = (property: Property) => {
    setSelectedProperty(property);
  };

  return (
    <div className="min-h-screen bg-background pb-[160px]">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4 text-center">AI Real Estate Assistant</h1>
          <p className="text-center text-muted-foreground mb-6">
            Ask me about homes, apartments, and investment properties across the U.S.
          </p>
          <SearchBar onSearch={(query) => handleSearch(query)} loading={searchLoading} />
        </div>

        {/* Property Carousel */}
        {properties.length > 0 && (
          <PropertyCarousel 
            properties={properties.map(p => ({ 
              ...p, 
              photoUrl: p.image_url || p.image_urls?.[0] || null,
              city: p.city || null,
              state: p.state || null,
              price: p.price || null,
              beds: p.beds || null,
              baths: p.baths || null,
              sqft: p.sqft || null
            }))} 
            onSelectProperty={handlePropertySelect}
          />
        )}

        {/* Selected Property Details */}
        {selectedProperty && (
          <Card className="max-w-4xl mx-auto mt-8">
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Property Header */}
                <div>
                  <h2 className="text-3xl font-bold text-primary mb-2">
                    {formatPrice(selectedProperty.price)}
                  </h2>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <p className="text-lg">
                      {selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state}
                    </p>
                  </div>
                </div>

                {/* Property Stats */}
                <div className="flex gap-6 text-lg">
                  <div className="flex items-center gap-2">
                    <Bed className="h-5 w-5" />
                    <span>{selectedProperty.beds} beds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bath className="h-5 w-5" />
                    <span>{selectedProperty.baths} baths</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Square className="h-5 w-5" />
                    <span>{selectedProperty.sqft} sqft</span>
                  </div>
                </div>

                {/* Description */}
                {selectedProperty.description && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">About this property</h3>
                    <p className="text-muted-foreground">{selectedProperty.description}</p>
                  </div>
                )}

                {/* External Link */}
                {selectedProperty.externalLink && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.open(selectedProperty.externalLink, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!properties.length && !searchLoading && (
          <EmptyState
            icon={Search}
            title="Start Your Property Search"
            description="Use the AI-powered search above to find your perfect property. Try searching for location, price range, bedrooms, or special features."
            actionLabel="View All Properties"
            onAction={() => handleSearch("Show me available properties")}
          />
        )}
      </div>
      
      {/* Follow-up Chat Box */}
      {selectedProperty && (
        <FollowUpChat 
          context={`Selected Property: ${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state} - ${formatPrice(selectedProperty.price)}`} 
          properties={[selectedProperty]}
          marketSnapshot={marketSnapshot}
        />
      )}
    </div>
  );
}
