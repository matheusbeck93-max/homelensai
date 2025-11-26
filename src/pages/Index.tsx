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

  // React Query for property search
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['property-search', searchParams],
    queryFn: async () => {
      if (!searchParams) return null;
      const { data, error } = await supabase.functions.invoke('search-listings', {
        body: searchParams
      });
      if (error) throw error;
      return data;
    },
    enabled: !!searchParams,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  // Process search results into conversation
  useEffect(() => {
    if (searchData && searchParams) {
      const listings = searchData.listings || [];
      
      if (listings.length > 0) {
        const uiBlock: UIBlock = {
          type: 'ui_block/property_results_grid',
          title: `Found ${listings.length} homes${searchParams.location ? ` in ${searchParams.location}` : ''}`,
          properties: listings,
          meta: {
            locationLabel: searchParams.location,
            totalResults: listings.length
          }
        };

        const assistantMessage: ConversationMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: '', // Message already added by AI in handleSendMessage
          uiBlock,
          createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const assistantMessage: ConversationMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: 'No properties found matching your criteria. Try adjusting your search filters.',
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    }
  }, [searchData, searchParams]);

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
      
      // Try to parse response as JSON first
      let jsonData: any = null;
      try {
        jsonData = typeof data.response === 'string' ? JSON.parse(data.response) : data;
      } catch {
        // Not JSON, will handle as plain text below
      }
      
      // Check if AI wants to trigger a property search
      if (jsonData && jsonData.searchParams) {
        // AI provided search parameters - add text response first
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: jsonData.message || 'Let me find those properties for you...',
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Parse location and trigger search
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
          content: jsonData.message || '',
          uiBlock: jsonData.uiBlock as UIBlock,
          createdAt: new Date().toISOString()
        };
      } else if (jsonData && jsonData.type && jsonData.type.startsWith('ui_block/')) {
        // Legacy format where entire response is a UI block
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: jsonData.message || '',
          uiBlock: jsonData as UIBlock,
          createdAt: new Date().toISOString()
        };
      } else {
        // Plain text response
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: jsonData ? (jsonData.message || data.response || 'I apologize, I couldn\'t process that request.') : (data.response || 'I apologize, I couldn\'t process that request.'),
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
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
          <HouseHeroAnimation />
          <div className="relative z-10 text-center px-4 py-20 max-w-5xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-foreground">
              Find Your Dream Home
            </h1>
            <p className="text-lg sm:text-xl mb-8 text-muted-foreground max-w-2xl mx-auto">
              AI-powered real estate search and analysis. Ask me anything about properties, mortgages, or investments.
            </p>

            {/* Hero Search Input */}
            <form onSubmit={handleHeroSubmit} className="max-w-3xl mx-auto">
              <div className="flex gap-2">
                <Input
                  value={heroInput}
                  onChange={(e) => setHeroInput(e.target.value)}
                  placeholder="Try: Find 3-bedroom fixers under $650k in Arlington with ROI over 15%"
                  disabled={conversationLoading || searchLoading}
                  className="h-14 text-base"
                />
                <Button 
                  type="submit"
                  disabled={conversationLoading || searchLoading || !heroInput.trim()}
                  size="lg"
                  className="h-14 px-8"
                >
                  <Search className="h-5 w-5 mr-2" />
                  Search
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Powered by AI – Search using natural language
              </p>
            </form>
          </div>
        </section>
      ) : (
        <section className="relative py-8 border-b">
          <div className="max-w-5xl mx-auto px-4">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Find Your Dream Home
            </h1>
            <p className="text-muted-foreground">
              AI-powered real estate search and analysis
            </p>
          </div>
        </section>
      )}

      {/* Quick Action Cards - Only show before conversation */}
      {!hasStartedConversation && (
        <section className="py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-semibold mb-8 text-center">How can I help you today?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {quickActions.map((action, idx) => (
                <Card
                  key={idx}
                  onClick={() => handleSendMessage(action.prompt)}
                  className="p-6 hover:bg-muted cursor-pointer transition-colors group"
                >
                  <action.icon className="h-10 w-10 mb-4 text-primary group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold mb-2">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {action.description}
                  </p>
                  <p className="text-sm text-primary italic">
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
        <div className="pb-32">
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
