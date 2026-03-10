import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/Navigation";
import { ConversationPanel, ConversationMessage } from "@/components/ConversationPanel";
import { StickyChat } from "@/components/StickyChat";
import { HouseHeroAnimation } from "@/components/HouseHeroAnimation";
import { UIBlock } from "@/types/ui-blocks";
import { parseLocationComponents } from "@/utils/propertySearchHelpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { Search, Filter, ChevronDown, ChevronUp, Calculator, Scale, Chrome, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FeaturedHomesGrid } from "@/components/FeaturedHomesGrid";
import { PropertyFilters, PropertyFiltersState } from "@/components/PropertyFilters";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { Footer } from "@/components/Footer";
import { useTypingPlaceholder } from "@/hooks/useTypingPlaceholder";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What exactly is HomeLens?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "HomeLens is not a property listing site. It's a decision platform designed to help you evaluate homes before making one of the biggest financial commitments of your life. Instead of just showing listings, HomeLens helps you understand affordability, risk, long-term cost, and whether a property truly makes financial sense for you. You can explore the market, analyze properties, compare options, and gain clarity — all guided by AI."
      }
    },
    {
      "@type": "Question",
      "name": "Can I paste any property listing URL?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. You can paste a listing URL from most major real estate platforms and HomeLens will generate a detailed financial and market analysis. We extract relevant property data and combine it with market insights, affordability models, and scenario projections — so you can see the full financial picture behind the listing. Pro users unlock deeper analysis, including advanced financial breakdowns and long-term projections."
      }
    },
    {
      "@type": "Question",
      "name": "Can HomeLens help me avoid overpaying?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "That's exactly what it's built for. HomeLens evaluates properties using financial modeling, local market data, and affordability analysis to help you understand if the price aligns with market trends, whether the monthly cost fits your financial profile, the long-term financial impact of your purchase, and the potential risk of stretching your budget. While no tool can predict the future, HomeLens gives you structured clarity instead of emotional guesswork."
      }
    },
    {
      "@type": "Question",
      "name": "How accurate are the financial estimates?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our calculations are based on standard mortgage formulas, publicly available market data, and your personalized financial inputs. They are designed to provide realistic projections and scenario modeling — not generic averages. However, estimates should always be validated with your lender or financial advisor before making a final decision. HomeLens is a decision-support tool, not financial advice."
      }
    },
    {
      "@type": "Question",
      "name": "What do I get with the Pro plan?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The Pro plan unlocks the full decision engine: advanced property analysis, detailed overpayment and risk indicators, long-term ownership projections, side-by-side comparison tools, saved analysis history, and ongoing tracking of properties and scenarios. If you're actively considering buying, Pro gives you deeper financial clarity and more confident decision-making."
      }
    }
  ]
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "HomeLens",
  "url": "https://homelens.ai",
  "logo": "https://homelens.ai/favicon.png",
  "description": "AI-powered decision platform that helps you evaluate homes, understand affordability, and make smarter real estate decisions.",
  "sameAs": [],
  "foundingDate": "2025",
  "knowsAbout": ["Real Estate", "Property Analysis", "Financial Modeling", "Market Intelligence"]
};

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
  const [heroFocused, setHeroFocused] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<string | null>(null);
  const typingPlaceholder = useTypingPlaceholder();
  const [extensionBannerDismissed, setExtensionBannerDismissed] = useState(() => 
    localStorage.getItem('extension-banner-dismissed') === 'true'
  );

  const handleDismissExtensionBanner = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExtensionBannerDismissed(true);
    localStorage.setItem('extension-banner-dismissed', 'true');
  };

  const CHROME_EXTENSION_URL = "https://chromewebstore.google.com/detail/homelens";

  // Filter state with defaults
  const [filters, setFilters] = useState<PropertyFiltersState>({
    priceMin: 0,
    priceMax: 2000000,
    bedsMin: null,
    bathsMin: null,
    propertyTypes: []
  });

  const hasStartedConversation = messages.length > 0;

  // JSON-LD structured data for SEO
  useEffect(() => {
    const faqScript = document.createElement('script');
    faqScript.type = 'application/ld+json';
    faqScript.text = JSON.stringify(faqJsonLd);
    faqScript.id = 'faq-jsonld';
    document.head.appendChild(faqScript);

    const orgScript = document.createElement('script');
    orgScript.type = 'application/ld+json';
    orgScript.text = JSON.stringify(organizationJsonLd);
    orgScript.id = 'org-jsonld';
    document.head.appendChild(orgScript);

    return () => {
      document.getElementById('faq-jsonld')?.remove();
      document.getElementById('org-jsonld')?.remove();
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    if (searchParams?.location) {
      await queryClient.invalidateQueries({ queryKey: ['property-search'] });
    }
    toast({
      title: "Refreshed",
      description: "Property listings updated"
    });
  }, [queryClient, searchParams, toast]);

  const { pullDistance, isRefreshing, containerProps } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    disabled: hasStartedConversation
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
      prop_type: filters.propertyTypes.length > 0 ?
      filters.propertyTypes.join(',') :
      searchParams.prop_type || 'any'
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
    retry: 1
  });

  // Handle search errors with graceful messaging
  useEffect(() => {
    if (searchError) {
      console.error('[Index] Search query error:', searchError);
      // Show toast only if we don't have cached data
      if (!searchData?.listings || searchData.listings.length === 0) {
        toast({
          title: "Search Issue",
          description: searchData?.message || "Using cached results where available. Some providers may be rate limited."
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
      propertyTypes: []
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) fetchUserProfile(session.user.id);
        else { setUserName(null); setPrimaryGoal(null); }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, primary_goal")
      .eq("id", userId)
      .single();
    if (data) {
      setUserName(data.full_name);
      setPrimaryGoal(data.primary_goal);
    }
  };

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
    setMessages((prev) => [...prev, userMessage]);

    // Send ALL messages to AI chat - let AI decide intent
    setConversationLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: messages.concat(userMessage).map((m) => ({
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
          setMessages((prev) => [...prev, assistantMessage]);
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

      setMessages((prev) => [...prev, assistantMessage]);
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
      // Navigate to /chats with the initial message
      navigate('/chats', { state: { initialMessage: heroInput.trim() } });
    }
  };


  return (
    <div
      className="min-h-screen flex flex-col bg-background touch-manipulation"
      {...containerProps}>

      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing} />

      <Navigation />

      {/* Chrome Extension Banner - only for logged-in users who haven't dismissed */}
      {user && !extensionBannerDismissed && !hasStartedConversation && (
        <a
          href={CHROME_EXTENSION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-3 relative group cursor-pointer hover:opacity-95 transition-opacity"
        >
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-3">
            <Chrome className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              <span className="hidden sm:inline">🚀 Analyze any listing instantly! Install the HomeLens Chrome Extension and get AI insights directly on Zillow, Redfin & more.</span>
              <span className="sm:hidden">🚀 Get the HomeLens Chrome Extension!</span>
            </p>
            <button
              onClick={handleDismissExtensionBanner}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-primary-foreground/20 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </a>
      )}

      {/* Hero Section */}
      {!hasStartedConversation ?
      <section className="relative min-h-[50vh] sm:min-h-[60vh] flex flex-col items-center justify-center overflow-hidden">
          <HouseHeroAnimation />
          <div className="relative z-10 text-center px-3 sm:px-4 md:px-6 pb-12 sm:pb-16 md:pb-20 max-w-5xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-foreground">
              {userName ? `Hello, ${userName.split(' ')[0]}` : 'Meet Your AI Real Estate Advisor'}
            </h1>
            <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-muted-foreground max-w-4xl mx-auto px-4 whitespace-nowrap">
              {userName && primaryGoal
                ? primaryGoal === 'invest' ? 'Your AI Investment Advisor — Find High-Yield Opportunities'
                : primaryGoal === 'buy_home' ? 'Your AI Home Buying Copilot — Find the Perfect Home'
                : primaryGoal === 'rent' ? 'Your AI Rental Advisor — Find the Best Deals'
                : primaryGoal === 'market_trends' ? 'Your AI Market Intelligence — Stay Ahead of Trends'
                : primaryGoal === 'tax_incentives' ? 'Your AI Financial Advisor — Maximize Tax Benefits'
                : 'Make Smarter Home Buying Decisions with AI Market Analysis'
                : 'Make Smarter Home Buying Decisions with AI Market Analysis'}
            </p>

            {/* Hero Search Input */}
            <form onSubmit={handleHeroSubmit} className="max-w-3xl mx-auto px-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                value={heroInput}
                onChange={(e) => setHeroInput(e.target.value)}
                onFocus={() => setHeroFocused(true)}
                onBlur={() => setHeroFocused(false)}
                placeholder={heroFocused ? "Type your question..." : typingPlaceholder}
                disabled={conversationLoading || searchLoading}
                className="h-12 sm:h-14 text-sm sm:text-base" />

                <Button
                type="submit"
                disabled={conversationLoading || searchLoading || !heroInput.trim()}
                size="lg"
                className="h-12 sm:h-14 px-6 sm:px-8 w-full sm:w-auto">

                  <Search className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Search
                </Button>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Powered by AI – Search using natural language
              </p>
            </form>

            {/* Feature Cards with Animations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-10 max-w-6xl mx-auto px-4">
              <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}>

                <Card className="p-5 text-left h-full hover:shadow-lg transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Search className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">Market Intelligence Search</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Analyze opportunities across the market using natural language.
                  </p>
                </Card>
              </motion.div>
              
              <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}>

                <Card className="p-5 text-left h-full hover:shadow-lg transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Filter className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">Property Analysis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Paste any listing URL for detailed AI-powered property analysis and insights.
                  </p>
                </Card>
              </motion.div>
              
              <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}>

                <Card className="p-5 text-left h-full hover:shadow-lg transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Scale className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">Compare Properties</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Compare properties and see which one truly makes sense.
                  </p>
                </Card>
              </motion.div>

              <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}>

                <Card className="p-5 text-left h-full hover:shadow-lg transition-shadow duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calculator className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">Financial Calculators</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Understand your buying power and long-term financial impact.
                  </p>
                </Card>
              </motion.div>

              <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}>

                <a href={CHROME_EXTENSION_URL} target="_blank" rel="noopener noreferrer" className="block h-full">
                  <Card className="p-5 text-left h-full hover:shadow-lg transition-shadow duration-300 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Chrome className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">Chrome Extension</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Analyze any listing directly on Zillow, Redfin & more with one click.
                    </p>
                  </Card>
                </a>
              </motion.div>
            </div>
          </div>
        </section> :

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
      }


      {/* Conversation Panel - Show after conversation starts */}
      {hasStartedConversation &&
      <div className="pb-24 sm:pb-32">
          <ConversationPanel
          messages={messages}
          loading={conversationLoading}
          onPropertyAnalyze={handlePropertyAnalyze} />

          
          {/* Property Search Results - Show hero cards when search params are active */}
          {searchParams?.location &&
        <>
              {/* Filter Toggle Button */}
              <div className="max-w-7xl mx-auto px-4 mb-4">
                <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2">

                  <Filter className="h-4 w-4" />
                  Filters
                  {showFilters ?
              <ChevronUp className="h-4 w-4" /> :

              <ChevronDown className="h-4 w-4" />
              }
                </Button>
              </div>

              {/* Filter Panel */}
              {showFilters &&
          <div className="max-w-7xl mx-auto px-4 mb-6">
                  <PropertyFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClear={clearFilters} />

                </div>
          }

              {searchListings.length > 0 &&
          <FeaturedHomesGrid
            title={`Search Results for ${searchParams.location}`}
            subtitle={searchData?.stale ?
            `Showing ${searchListings.length} cached properties (API temporarily unavailable)` :
            `Found ${searchListings.length} properties from ${searchData?.source || 'Zillow'}`
            }
            listings={searchListings}
            isLoading={searchLoading}
            error={searchError && searchListings.length === 0 ? "Failed to load properties" : null}
            hasMore={false}
            onAnalyze={handlePropertyAnalyze} />

          }
              
              {/* Loading state for property search */}
              {searchLoading && searchListings.length === 0 &&
          <div className="max-w-7xl mx-auto px-4 py-8">
                  <div className="text-center">
                    <p className="text-muted-foreground">Searching for properties...</p>
                  </div>
                </div>
          }

              {/* Empty state */}
              {!searchLoading && searchListings.length === 0 &&
          <div className="max-w-7xl mx-auto px-4 py-8">
                  <div className="text-center">
                    <p className="text-muted-foreground">
                      {searchData?.message || "No properties found matching your criteria. Try adjusting your filters."}
                    </p>
                  </div>
                </div>
          }
            </>
        }
        </div>
      }


      {/* Sticky Chat Input - Only show after conversation starts */}
      {hasStartedConversation &&
      <StickyChat
        onSend={handleSendMessage}
        loading={conversationLoading || searchLoading} />

      }

      {/* FAQ Section */}
      {!hasStartedConversation &&
      <section className="py-16 px-4 bg-background">
          <div className="max-w-3xl mx-auto">
            <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}>

              <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">
                Frequently Asked Questions
              </h2>
            </motion.div>
            
            <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}>

              <Accordion type="single" collapsible className="w-full space-y-2">
                <AccordionItem value="item-1" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-left">
                    What exactly is HomeLens?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-3">
                    <p>HomeLens is not a property listing site. It's a decision platform designed to help you evaluate homes before making one of the biggest financial commitments of your life.</p>
                    <p>Instead of just showing listings, HomeLens helps you understand affordability, risk, long-term cost, and whether a property truly makes financial sense for you.</p>
                    <p>You can explore the market, analyze properties, compare options, and gain clarity — all guided by AI.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-left">
                    Can I paste any property listing URL?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-3">
                    <p>Yes. You can paste a listing URL from most major real estate platforms and HomeLens will generate a detailed financial and market analysis.</p>
                    <p>We extract relevant property data and combine it with market insights, affordability models, and scenario projections — so you can see the full financial picture behind the listing.</p>
                    <p>Pro users unlock deeper analysis, including advanced financial breakdowns and long-term projections.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-left">
                    Can HomeLens help me avoid overpaying?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-3">
                    <p>That's exactly what it's built for.</p>
                    <p>HomeLens evaluates properties using financial modeling, local market data, and affordability analysis to help you understand:</p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                      <li>If the price aligns with market trends</li>
                      <li>Whether the monthly cost fits your financial profile</li>
                      <li>The long-term financial impact of your purchase</li>
                      <li>The potential risk of stretching your budget</li>
                    </ul>
                    <p>While no tool can predict the future, HomeLens gives you structured clarity instead of emotional guesswork.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-left">
                    How accurate are the financial estimates?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-3">
                    <p>Our calculations are based on standard mortgage formulas, publicly available market data, and your personalized financial inputs.</p>
                    <p>They are designed to provide realistic projections and scenario modeling — not generic averages.</p>
                    <p>However, estimates should always be validated with your lender or financial advisor before making a final decision. HomeLens is a decision-support tool, not financial advice.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-left">
                    What do I get with the Pro plan?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-3">
                    <p>The Pro plan unlocks the full decision engine:</p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                      <li>Advanced property analysis</li>
                      <li>Detailed overpayment and risk indicators</li>
                      <li>Long-term ownership projections</li>
                      <li>Side-by-side comparison tools</li>
                      <li>Saved analysis history</li>
                      <li>Ongoing tracking of properties and scenarios</li>
                    </ul>
                    <p>If you're actively considering buying, Pro gives you deeper financial clarity and more confident decision-making.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </motion.div>
          </div>
        </section>
      }

      {/* Footer */}
      {!hasStartedConversation && <Footer />}
    </div>);

}