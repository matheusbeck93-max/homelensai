import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/Navigation";
import { ConversationPanel, ConversationMessage } from "@/components/ConversationPanel";
import { StickyChat } from "@/components/StickyChat";
import { HouseHeroAnimation } from "@/components/HouseHeroAnimation";
import { HomeLensListing, UIBlock } from "@/types/ui-blocks";
import { isPropertySearchQuery, parsePropertySearchQuery, parseLocationComponents } from "@/utils/propertySearchHelpers";
import { useQuery } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { Search, Calculator, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FeaturedHomesGrid } from "@/components/FeaturedHomesGrid";
import { useFeaturedHomes } from "@/hooks/useFeaturedHomes";

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [searchParams, setSearchParams] = useState<any>(null);
  const [heroInput, setHeroInput] = useState("");
  
  const hasStartedConversation = messages.length > 0;

  // Featured homes hook
  const { 
    locationLabel: featuredLocation, 
    listings: featuredListings, 
    isLoading: featuredLoading, 
    error: featuredError,
    hasMore: featuredHasMore,
    loadMore: loadMoreFeatured
  } = useFeaturedHomes();

  // DISABLED: React Query for property search - causes rate limit errors
  // AI now generates property links directly without calling search-listings API
  const { data: searchData, isLoading: searchLoading, error: searchError } = useQuery({
    queryKey: ['property-search', searchParams],
    queryFn: async () => {
      return null; // Disabled to prevent rate limit errors
    },
    enabled: false, // CRITICAL: Completely disable this query
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 0,
  });

  // DISABLED: Search error handling - no longer needed since search-listings is disabled
  // useEffect(() => {
  //   if (searchError) { ... }
  // }, [searchError, toast]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  // DISABLED: Process search results - no longer needed since AI provides links directly
  // useEffect(() => {
  //   if (searchData && searchParams) { ... }
  // }, [searchData, searchParams]);

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;
    
    // Clear hero input if used
    setHeroInput("");
    
    // Add user message
    const userMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    // Send ALL messages to AI chat - let AI decide intent
    setConversationLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: messages.concat(userMessage).map(m => ({
            role: m.role,
            content: m.content
          })),
          conversationMode: true
        }
      });

      if (error) throw error;

      // Parse AI response
      let assistantMessage: ConversationMessage;

      // Backend returns { response: { message: "...", searchParams?: {...} } }
      let rawResponse: any = data?.response ?? data;
      let jsonData: any = null;

      // If response is already an object with message field, use it directly
      if (rawResponse && typeof rawResponse === 'object' && rawResponse.message) {
        jsonData = rawResponse;
      } else if (typeof rawResponse === 'string') {
        // Try to parse if it's a JSON string (legacy format)
        try {
          jsonData = JSON.parse(rawResponse);
        } catch {
          // Not JSON, treat rawResponse as plain text message
          jsonData = { message: rawResponse };
        }
      } else {
        // Fallback for unexpected formats
        jsonData = { message: String(rawResponse || 'No response received') };
      }

      // Extract clean message for display
      const displayMessage = jsonData.message || '';

      // Check if AI has property links - display them without calling search-listings
      if (jsonData && jsonData.links && Array.isArray(jsonData.links) && jsonData.links.length > 0) {
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: displayMessage || 'Here are some property listings:',
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setConversationLoading(false);
        return;
      }
      
      // DEPRECATED: Don't trigger search-listings from chat to avoid rate limits
      // If AI really needs property data (not just links), it should be handled differently
      if (jsonData && jsonData.searchParams && false) {
        // This code path is disabled to prevent rate limit errors
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: displayMessage || 'Let me find those properties for you...',
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        const locationComponents = parseLocationComponents(jsonData.searchParams.location);
        setSearchParams({
          ...jsonData.searchParams,
          ...locationComponents
        });
        setConversationLoading(false);
        return;
      }
      
      // Check for UI blocks
      if (jsonData && jsonData.uiBlock) {
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: displayMessage,
          uiBlock: jsonData.uiBlock as UIBlock,
          createdAt: new Date().toISOString()
        };
      } else if (jsonData && jsonData.type && jsonData.type.startsWith('ui_block/')) {
        // Legacy format where entire response is a UI block
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: displayMessage,
          uiBlock: jsonData as UIBlock,
          createdAt: new Date().toISOString()
        };
      } else {
        // Plain text response (clean message from backend)
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: displayMessage || 'I apologize, I couldn\'t process that request.',
          createdAt: new Date().toISOString()
        };
      }
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI chat error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setConversationLoading(false);
    }
  };

  const handlePropertyAnalyze = (property: any) => {
    const message = `Analyze this property: ${property.address}, ${property.city}, ${property.state}. Price: $${property.price?.toLocaleString()}, ${property.beds} beds, ${property.baths} baths, ${property.sqft} sqft.`;
    handleSendMessage(message);
  };

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroInput.trim()) {
      handleSendMessage(heroInput);
    }
  };

  const quickActions = [
    {
      icon: Search,
      title: "Search for homes",
      prompt: "Find 3-bedroom homes under $500k in Austin, Texas",
      description: "Natural language property search"
    },
    {
      icon: Calculator,
      title: "Calculate mortgage",
      prompt: "What mortgage rate can I get?",
      description: "Get personalized mortgage estimates"
    },
    {
      icon: TrendingUp,
      title: "Investment advice",
      prompt: "How do I calculate ROI on a rental property?",
      description: "Real estate investing insights"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      {/* Hero Section */}
      {!hasStartedConversation ? (
        <section className="relative min-h-[50vh] sm:min-h-[60vh] flex items-center justify-center overflow-hidden">
          <HouseHeroAnimation />
          <div className="relative z-10 text-center px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-20 max-w-5xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-foreground">
              Find Your Dream Home
            </h1>
            <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-muted-foreground max-w-2xl mx-auto px-4">
              AI-powered real estate search and analysis. Ask me anything about properties, mortgages, or investments.
            </p>

            {/* Hero Search Input */}
            <form onSubmit={handleHeroSubmit} className="max-w-3xl mx-auto px-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={heroInput}
                  onChange={(e) => setHeroInput(e.target.value)}
                  placeholder="Try: Find 3-bedroom fixers under $650k in Arlington with ROI over 15%"
                  disabled={conversationLoading || searchLoading}
                  className="h-12 sm:h-14 text-sm sm:text-base"
                />
                <Button 
                  type="submit"
                  disabled={conversationLoading || searchLoading || !heroInput.trim()}
                  size="lg"
                  className="h-12 sm:h-14 px-6 sm:px-8 w-full sm:w-auto"
                >
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Search
                </Button>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Powered by AI – Search using natural language
              </p>
            </form>
          </div>
        </section>
      ) : (
        <section className="relative py-6 sm:py-8 border-b">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Find Your Dream Home
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              AI-powered real estate search and analysis
            </p>
          </div>
        </section>
      )}

      {/* Quick Action Cards - Only show before conversation */}
      {!hasStartedConversation && (
        <section className="py-8 sm:py-12 px-3 sm:px-4 md:px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-semibold mb-6 sm:mb-8 text-center">How can I help you today?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {quickActions.map((action, idx) => (
                <Card
                  key={idx}
                  onClick={() => handleSendMessage(action.prompt)}
                  className="p-4 sm:p-6 hover:bg-muted cursor-pointer transition-colors group"
                >
                  <action.icon className="h-8 w-8 sm:h-10 sm:w-10 mb-3 sm:mb-4 text-primary group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold mb-2 text-sm sm:text-base">{action.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                    {action.description}
                  </p>
                  <p className="text-xs sm:text-sm text-primary italic line-clamp-2">
                    "{action.prompt}"
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Conversation Panel - Show after conversation starts */}
      {hasStartedConversation && (
        <div className="pb-24 sm:pb-32">
          <ConversationPanel
            messages={messages}
            loading={conversationLoading}
            onPropertyAnalyze={handlePropertyAnalyze}
          />
        </div>
      )}

      {/* Featured Homes - Only show before conversation starts */}
      {!hasStartedConversation && (
        <FeaturedHomesGrid
          title={featuredLocation ? `Featured Homes near ${featuredLocation}` : "Featured Homes"}
          subtitle="Handpicked properties in popular markets"
          listings={featuredListings}
          isLoading={featuredLoading}
          error={featuredError}
          hasMore={featuredHasMore}
          onLoadMore={loadMoreFeatured}
          onAnalyze={handlePropertyAnalyze}
        />
      )}

      {/* Sticky Chat Input - Only show after conversation starts */}
      {hasStartedConversation && (
        <StickyChat
          onSend={handleSendMessage}
          loading={conversationLoading || searchLoading}
        />
      )}

      {/* Footer */}
      {!hasStartedConversation && (
        <footer className="bg-muted py-8 mt-auto">
          <div className="container mx-auto px-4 text-center text-muted-foreground">
            <p>&copy; 2025 HomeLens. All rights reserved.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
