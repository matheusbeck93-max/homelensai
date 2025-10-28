import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Bed, Bath, Square, MapPin } from "lucide-react";
import PropertyCarousel from "@/components/PropertyCarousel";
import FollowUpChat from "@/components/FollowUpChat";
import { generateZillowLink } from "@/lib/externalLinks";
import { Button } from "@/components/ui/button";

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  image_urls?: string[];
  image_url?: string;
  description?: string;
  externalLink?: string;
  zip?: string;
}

export default function Properties() {
  const [assistantResponse, setAssistantResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const generateMockProperties = (query: string): Property[] => {
    // Extract location from query if possible
    const locationMatch = query.match(/in\s+([^,\n]+)/i);
    const city = locationMatch ? locationMatch[1].trim() : "Arlington";
    
    const properties = [
      {
        id: "1",
        address: "123 Wilson Blvd",
        city: city,
        state: "VA",
        price: 425000,
        beds: 3,
        baths: 2,
        sqft: 1800,
        image_url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
        description: "Modern apartment with updated kitchen"
      },
      {
        id: "2",
        address: "456 Clarendon Blvd",
        city: city,
        state: "VA",
        price: 395000,
        beds: 3,
        baths: 2.5,
        sqft: 1650,
        image_url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
        description: "Beautiful unit with city views"
      },
      {
        id: "3",
        address: "789 Columbia Pike",
        city: city,
        state: "VA",
        price: 385000,
        beds: 3,
        baths: 2,
        sqft: 1700,
        image_url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
        description: "Spacious living with hardwood floors"
      },
      {
        id: "4",
        address: "321 Lee Highway",
        city: city,
        state: "VA",
        price: 450000,
        beds: 3,
        baths: 2,
        sqft: 1900,
        image_url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
        description: "Luxury apartment with amenities"
      },
      {
        id: "5",
        address: "567 Washington Blvd",
        city: city,
        state: "VA",
        price: 410000,
        beds: 3,
        baths: 2,
        sqft: 1750,
        image_url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
        description: "Contemporary design with balcony"
      }
    ];
    
    // Add external links to each property
    return properties.map(prop => ({
      ...prop,
      externalLink: generateZillowLink(prop)
    }));
  };

  const handleSearch = useCallback(async (query: string, categories?: string[]) => {
    if (!query.trim()) return;
    
    setSearchLoading(true);
    setAssistantResponse("");
    setProperties([]);
    
    try {
      // First, search for actual properties in the database
      const { data: searchData, error: searchError } = await supabase.functions.invoke('ai-search', {
        body: { query, categories }
      });

      if (searchError) throw searchError;

      const foundProperties = searchData?.properties || [];
      
      // If no properties found in database, use mock properties
      let propsToUse = foundProperties.length > 0 ? foundProperties : generateMockProperties(query);
      
      // Add external links to all properties
      propsToUse = propsToUse.map(prop => ({
        ...prop,
        externalLink: prop.externalLink || generateZillowLink(prop)
      }));
      
      setProperties(propsToUse);

      // Then get AI analysis of those properties
      const { data: assistantData, error: assistantError } = await supabase.functions.invoke('property-assistant', {
        body: { 
          query,
          categories,
          properties: propsToUse
        }
      });

      if (assistantError) throw assistantError;

      setAssistantResponse(assistantData?.response || "I found some properties for you!");
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
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
            properties={properties.map(p => ({ ...p, image_url: p.image_url || p.image_urls?.[0] || '' }))} 
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
                    View on Zillow
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!properties.length && !loading && (
          <div className="text-center py-12 max-w-2xl mx-auto">
            <p className="text-xl text-muted-foreground mb-6">
              👋 Welcome! I'm your AI real estate assistant.
            </p>
            <div className="text-left space-y-4 text-muted-foreground">
              <p>Try asking me things like:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>"Find me houses with 3 bedrooms under $600,000 in Miami"</li>
                <li>"Show me apartments near Austin with a pool"</li>
                <li>"I'm looking for investment properties in Phoenix"</li>
                <li>"2-bedroom condos in Seattle with parking"</li>
              </ul>
            </div>
          </div>
        )}
      </div>
      
      {/* Follow-up Chat Box */}
      {selectedProperty && (
        <FollowUpChat 
          context={`Selected Property: ${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state} - ${formatPrice(selectedProperty.price)}`} 
          properties={[selectedProperty]} 
        />
      )}
    </div>
  );
}
