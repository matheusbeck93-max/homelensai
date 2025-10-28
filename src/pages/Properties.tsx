import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import FollowUpChat from "@/components/FollowUpChat";

export default function Properties() {
  const [assistantResponse, setAssistantResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const handleSearch = useCallback(async (query: string, categories?: string[]) => {
    if (!query.trim()) return;
    
    setSearchLoading(true);
    setAssistantResponse("");
    
    try {
      const { data, error } = await supabase.functions.invoke("property-assistant", {
        body: { query, categories },
      });

      if (error) throw error;

      if (data?.response) {
        setAssistantResponse(data.response);
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
      <FollowUpChat context={assistantResponse} />
    </div>
  );
}
