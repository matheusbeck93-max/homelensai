import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import FollowUpChat from "@/components/FollowUpChat";

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

export default function Properties() {
  const [assistantResponse, setAssistantResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const generateMockProperties = (query: string): Property[] => {
    // Extract location from query if possible
    const locationMatch = query.match(/in\s+([^,\n]+)/i);
    const city = locationMatch ? locationMatch[1].trim() : "Arlington";
    
    return [
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
  };

  const handleSearch = useCallback(async (query: string, categories?: string[]) => {
    if (!query.trim()) return;
    
    setSearchLoading(true);
    setAssistantResponse("");
    setProperties([]);
    
    try {
      const { data, error } = await supabase.functions.invoke("property-assistant", {
        body: { query, categories },
      });

      if (error) throw error;

      if (data?.response) {
        setAssistantResponse(data.response);
        // Generate mock properties based on search
        const mockProps = generateMockProperties(query);
        setProperties(mockProps);
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

  const renderMarkdownLinks = (text: string) => {
    // Convert markdown links [text](url) to clickable links
    const parts = text.split(/(\[.*?\]\(.*?\))/g);
    
    return parts.map((part, index) => {
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        const [, linkText, url] = linkMatch;
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
          >
            <ExternalLink className="h-4 w-4" />
            {linkText}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
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

        {assistantResponse && (
          <Card className="max-w-4xl mx-auto">
            <CardContent className="pt-6">
              <div className="prose prose-lg max-w-none dark:prose-invert">
                {assistantResponse.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-4 whitespace-pre-wrap">
                    {renderMarkdownLinks(paragraph)}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!assistantResponse && !loading && (
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
      <FollowUpChat context={assistantResponse} properties={properties} />
    </div>
  );
}
