import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/Navigation";
import { ConversationPanel, ConversationMessage } from "@/components/ConversationPanel";
import { StickyChat } from "@/components/StickyChat";
import { HouseHeroAnimation } from "@/components/HouseHeroAnimation";
import { HomeLensListing, UIBlock } from "@/types/ui-blocks";
import { isPropertySearchQuery, parsePropertySearchQuery, parseLocationComponents } from "@/utils/propertySearchHelpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FeaturedHomesGrid } from "@/components/FeaturedHomesGrid";
import { useFeaturedHomes } from "@/hooks/useFeaturedHomes";
import { PropertyFilters, PropertyFiltersState } from "@/components/PropertyFilters";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [searchParams, setSearchParams] = useState<any>(null);
  const [heroInput, setHeroInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state with defaults
  const [filters, setFilters] = useState<PropertyFiltersState>({
    priceMin: 0,
    priceMax: 2000000,
    bedsMin: null,
    bathsMin: null,
    propertyTypes: [],
  });
  
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

  // Pull to refresh functionality
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['featured-homes'] });
    if (searchParams?.location) {
      await queryClient.invalidateQueries({ queryKey: ['property-search'] });
    }
    toast({
      title: "Refreshed",
      description: "Property listings updated",
    });
  }, [queryClient, searchParams, toast]);

  const { pullDistance, isRefreshing, containerProps } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    disabled: hasStartedConversation,
  });

  // Merge AI search params with user filter overrides for the query
  const effectiveSearchParams = useMemo(() => {
    if (!searchParams?.location) return null;
    return {
      location: searchParams.location,
      price_min: filters.priceMin,
      price_max: filters.priceMax,
      beds_min: filters.bedsMin ?? searchParams.beds_min ?? 0,
      baths_min: filters.bathsMin ?? searchParams.baths_min ?? 0,
      prop_type: filters.propertyTypes.length > 0 
        ? filters.propertyTypes.join(',') 
        : searchParams.prop_type || 'any',
    };
  }, [searchParams, filters]);

  // Property search using React Query - properly rate-limited via cache
  const { data: searchData, isLoading: searchLoading, error: searchError } = useQuery({
    queryKey: ['property-search', effectiveSearchParams],
    queryFn: async () => {
      if (!effectiveSearchParams?.location) return null;
      
      console.log('[Index] Fetching properties with params:', effectiveSearchParams);
      
      const { data, error } = await supabase.functions.invoke('search-listings', {
        body: effectiveSearchParams
      });

      if (error) {
        console.error('[Index] Search error:', error);
        throw error;
      }

      console.log('[Index] Search results:', data?.listings?.length || 0, 'properties from', data?.source);
      return data;
    },
    enabled: !!effectiveSearchParams?.location,
    staleTime: 15 * 60 * 1000, // 15 minutes cache
    gcTime: 20 * 60 * 1000,
    retry: 1,
  });

  // Handle search errors with graceful messaging
  useEffect(() => {
    if (searchError) {
      console.error('[Index] Search query error:', searchError);
      // Show toast only if we don't have cached data
      if (!searchData?.listings || searchData.listings.length === 0) {
        toast({
          title: "Search Issue",
          description: searchData?.message || "Using cached results where available. Some providers may be rate limited.",
        });
      }
    }
  }, [searchError, searchData, toast]);

  // Reset filters when new search starts from AI
  const handleFiltersChange = useCallback((newFilters: PropertyFiltersState) => {
    setFilters(newFilters);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      priceMin: 0,
      priceMax: 2000000,
      bedsMin: null,
      bathsMin: null,
      propertyTypes: [],
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  // Extract search results as hero card listings
  const searchListings = searchData?.listings || [];

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
      
      // Check if AI wants to trigger a property search
      if (jsonData && jsonData.searchParams && jsonData.searchParams.location) {
        console.log('[Index] AI provided searchParams, triggering property search:', jsonData.searchParams);
        
        // Only add message if it's not empty/duplicate
        if (displayMessage && displayMessage.trim()) {
          assistantMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: displayMessage,
            createdAt: new Date().toISOString()
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        
        // Parse location components and trigger search
        const locationComponents = parseLocationComponents(jsonData.searchParams.location);
        setSearchParams({
          location: jsonData.searchParams.location,
          price_min: jsonData.searchParams.price_min || 0,
          price_max: jsonData.searchParams.price_max || 2000000,
          beds_min: jsonData.searchParams.beds_min || 0,
          baths_min: jsonData.searchParams.baths_min || 0,
          prop_type: jsonData.searchParams.prop_type || 'any',
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
    const priceStr = property.price ? `$${property.price.toLocaleString()}` : 'Price N/A';
    const bedsStr = property.beds ?? 'N/A';
    const bathsStr = property.baths ?? 'N/A';
    const sqftStr = property.sqft ?? 'N/A';
    const message = `Analyze this property: ${property.address || 'Unknown'}, ${property.city || ''}, ${property.state || ''}. Price: ${priceStr}, ${bedsStr} beds, ${bathsStr} baths, ${sqftStr} sqft.`;
    handleSendMessage(message);
  };

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroInput.trim()) {
      handleSendMessage(heroInput);
    }
  };


  return (
    <div 
      className="min-h-screen flex flex-col bg-background touch-manipulation"
      {...containerProps}
    >
      <PullToRefreshIndicator 
        pullDistance={pullDistance} 
        isRefreshing={isRefreshing} 
      />
      <Navigation />

      {/* Hero Section */}
      {!hasStartedConversation ? (
        <section className="relative min-h-[50vh] sm:min-h-[60vh] flex flex-col items-center justify-center overflow-hidden">
          <HouseHeroAnimation />
          <div className="relative z-10 text-center px-3 sm:px-4 md:px-6 pb-12 sm:pb-16 md:pb-20 max-w-5xl mx-auto">
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


      {/* Conversation Panel - Show after conversation starts */}
      {hasStartedConversation && (
        <div className="pb-24 sm:pb-32">
          <ConversationPanel
            messages={messages}
            loading={conversationLoading}
            onPropertyAnalyze={handlePropertyAnalyze}
          />
          
          {/* Property Search Results - Show hero cards when search params are active */}
          {searchParams?.location && (
            <>
              {/* Filter Toggle Button */}
              <div className="max-w-7xl mx-auto px-4 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {showFilters ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Filter Panel */}
              {showFilters && (
                <div className="max-w-7xl mx-auto px-4 mb-6">
                  <PropertyFilters
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    onClear={clearFilters}
                  />
                </div>
              )}

              {searchListings.length > 0 && (
                <FeaturedHomesGrid
                  title={`Search Results for ${searchParams.location}`}
                  subtitle={searchData?.stale 
                    ? `Showing ${searchListings.length} cached properties (API temporarily unavailable)` 
                    : `Found ${searchListings.length} properties from ${searchData?.source || 'Zillow'}`
                  }
                  listings={searchListings}
                  isLoading={searchLoading}
                  error={searchError && searchListings.length === 0 ? "Failed to load properties" : null}
                  hasMore={false}
                  onAnalyze={handlePropertyAnalyze}
                />
              )}
              
              {/* Loading state for property search */}
              {searchLoading && searchListings.length === 0 && (
                <div className="max-w-7xl mx-auto px-4 py-8">
                  <div className="text-center">
                    <p className="text-muted-foreground">Searching for properties...</p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!searchLoading && searchListings.length === 0 && (
                <div className="max-w-7xl mx-auto px-4 py-8">
                  <div className="text-center">
                    <p className="text-muted-foreground">
                      {searchData?.message || "No properties found matching your criteria. Try adjusting your filters."}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
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
