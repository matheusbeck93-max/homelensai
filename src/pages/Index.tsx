import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/Navigation";
import { ConversationPanel, ConversationMessage } from "@/components/ConversationPanel";
import { StickyChat, ChatAttachment } from "@/components/StickyChat";
import { HouseHeroAnimation } from "@/components/HouseHeroAnimation";
import { UIBlock } from "@/types/ui-blocks";
import { parseLocationComponents } from "@/utils/propertySearchHelpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { Search, Filter, ChevronDown, ChevronUp, Calculator, Scale, Chrome, X, Sparkles, Home as HomeIcon, Bookmark, User, MessageSquare, TrendingUp, FileSpreadsheet } from "lucide-react";
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
import { PricingSection } from "@/components/PricingSection";
import { useTypingPlaceholder } from "@/hooks/useTypingPlaceholder";
import chromeExtensionImg from "@/assets/chrome-ext-home.jpg.asset.json";
import chatFeatureImg from "@/assets/chat-feature.jpg";
import buyingPowerImg from "@/assets/buying-power-feature.jpg";

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
    },
    {
      "@type": "Question",
      "name": "How does the HomeLens Chrome Extension work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The HomeLens Chrome Extension brings AI-powered analysis directly to your browser while you browse listings on sites like Zillow, Redfin, and Realtor.com. Once installed, it automatically detects property listings and lets you get instant AI analysis, a personalized Property Match Score, and ask follow-up questions — all synced with your HomeLens account."
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

      const { data, error } = await supabase.functions.invoke('search-listings', {
        body: effectiveSearchParams
      });

      if (error) {
        throw error;
      }
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
        // AI provided searchParams, trigger property search

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
              <span className="hidden sm:inline">Analyze any listing instantly! Install the HomeLens Chrome Extension and get AI insights on any real estate website.</span>
              <span className="sm:hidden">Get the HomeLens Chrome Extension!</span>
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
              {userName ? `Hello, ${userName.split(' ')[0]}` : 'Meet Your Real Estate Advisor'}
            </h1>
            <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-muted-foreground max-w-4xl mx-auto px-4">
              {userName && primaryGoal
                ? primaryGoal === 'invest' ? 'Your AI Investment Advisor — Find High-Yield Opportunities'
                : primaryGoal === 'buy_home' ? 'Your AI Home Buying Copilot — Find the Perfect Home'
                : primaryGoal === 'rent' ? 'Your AI Rental Advisor — Find the Best Deals'
                : primaryGoal === 'market_trends' ? 'Your AI Market Intelligence — Stay Ahead of Trends'
                : primaryGoal === 'tax_incentives' ? 'Your AI Financial Advisor — Maximize Tax Benefits'
                : 'Big decisions deserve the full picture'
                : 'Big decisions deserve the full picture'}
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
            {!user && (
            <>
            <h2 className="sr-only">What HomeLens does</h2>
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

<div className="block h-full cursor-default">
                <Card className="p-5 text-left h-full border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
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
                </div>
              </motion.div>
            </div>
            </>
            )}
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

      {/* Chrome Extension + Investor feature sections */}
      {!hasStartedConversation && !user && (
        <>
          <section className="py-16 sm:py-24 px-4 bg-background border-t">
            <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
                  <Chrome className="h-3.5 w-3.5" />
                  Chrome Extension
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
                  Analyze any listing without leaving the page.
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground mb-6 max-w-lg">
                  Get instant AI insights and a personalized Match Score on any listing website — one click, zero copy-paste.
                </p>
                <Button asChild size="lg">
                  <a href={CHROME_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                    <Chrome className="h-4 w-4" />
                    Add to Chrome
                  </a>
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 to-transparent rounded-3xl blur-2xl" />
                <img
                  src={chromeExtensionImg.url}
                  alt="HomeLens Chrome extension showing AI property analysis on a Zillow listing"
                  loading="lazy"
                  width={1280}
                  height={896}
                  className="relative rounded-2xl shadow-2xl border border-border/50 w-full"
                />
              </motion.div>
            </div>
          </section>

          {/* Investor Tools — feature card grid */}
          <section className="py-16 sm:py-24 px-4 bg-muted/30 border-t">
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-center mb-12 sm:mb-16"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-medium mb-4">
                  <Calculator className="h-3.5 w-3.5" />
                  For Investors
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
                  Everything real estate investors need,<br className="hidden sm:block" /> all in one place.
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                  Powerful tools. Real insights. Smarter decisions.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {[
                  {
                    icon: Sparkles,
                    title: "Investor Brief",
                    desc: "Your daily portfolio & market snapshot.",
                    href: "/investor/brief",
                    body: (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2">
                          <span className="text-muted-foreground">Total value</span>
                          <span className="font-semibold tabular-nums">$506k</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2">
                          <span className="text-muted-foreground">Tappable equity</span>
                          <span className="font-semibold tabular-nums text-emerald-600">$134k</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2">
                          <span className="text-primary font-medium">1 portfolio alert</span>
                          <span className="text-[10px] font-semibold text-primary">NEW</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    icon: HomeIcon,
                    title: "My Properties",
                    desc: "Track performance across your portfolio.",
                    href: "/investor/my-properties",
                    body: (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md bg-muted/60 px-3 py-2">
                          <div className="text-[10px] text-muted-foreground">Equity</div>
                          <div className="font-semibold tabular-nums">$206k</div>
                        </div>
                        <div className="rounded-md bg-muted/60 px-3 py-2">
                          <div className="text-[10px] text-muted-foreground">Cash flow</div>
                          <div className="font-semibold tabular-nums">$375/mo</div>
                        </div>
                        <div className="rounded-md bg-muted/60 px-3 py-2">
                          <div className="text-[10px] text-muted-foreground">Cap rate</div>
                          <div className="font-semibold tabular-nums">5.62%</div>
                        </div>
                        <div className="rounded-md bg-muted/60 px-3 py-2">
                          <div className="text-[10px] text-muted-foreground">Appreciation</div>
                          <div className="font-semibold tabular-nums text-emerald-600">$106k</div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    icon: Bookmark,
                    title: "Saved Analyses",
                    desc: "Your investment due-diligence history.",
                    href: "/investor/saved",
                    body: (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                          <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 font-bold text-xs">80</div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">3367 S Wakefield St</div>
                            <div className="text-[10px] text-muted-foreground">Strong fit · $815k</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-600 font-bold text-xs">70</div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">12500 Sulky Ct</div>
                            <div className="text-[10px] text-muted-foreground">Worth a look</div>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    icon: Calculator,
                    title: "Investor Calculator",
                    desc: "Analyze deals with precision.",
                    href: "/investor/calculator",
                    body: (
                      <div className="space-y-2 text-xs">
                        <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-rose-600">
                          DSCR 0.00x — below 1.25x threshold
                        </div>
                        <div className="rounded-md bg-muted/60 px-3 py-2 flex items-center justify-between">
                          <span className="text-muted-foreground">Net monthly cash flow</span>
                          <span className="font-semibold tabular-nums text-rose-600">-$100</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <FileSpreadsheet className="h-3 w-3" /> Export to Excel
                        </div>
                      </div>
                    ),
                  },
                  {
                    icon: TrendingUp,
                    title: "Buying Power",
                    desc: "Know exactly what you can afford.",
                    href: "/buying-power",
                    body: (
                      <div className="space-y-2 text-xs">
                        <div className="rounded-md bg-primary/5 px-3 py-3 text-center">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">You can afford</div>
                          <div className="text-xl font-bold text-primary tabular-nums">$645,000</div>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2">
                          <span className="text-muted-foreground">Est. monthly</span>
                          <span className="font-semibold tabular-nums">$4,153</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    icon: User,
                    title: "Set Up Your Profile",
                    desc: "Personalized results for smarter searches.",
                    href: "/profile-setup",
                    body: (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Goal</span>
                          <span className="font-medium">Buy a home</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px] font-medium">Woodbridge, VA</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px] font-medium">Springfield, VA</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Budget</span>
                          <span className="font-medium tabular-nums">Max $700k</span>
                        </div>
                      </div>
                    ),
                  },
                ].map((feature, i) => (
                  <motion.a
                    key={feature.title}
                    href={feature.href}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="group relative rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-start gap-3 mb-4">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <feature.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground leading-tight">{feature.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{feature.desc}</p>
                      </div>
                    </div>
                    {feature.body}
                  </motion.a>
                ))}
              </div>
            </div>
          </section>

          {/* Chat + Buying Power feature showcase */}
          <section className="py-16 sm:py-24 px-4 bg-background border-t">
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-center mb-12"
              >
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
                  Ask anything. Know what you can afford.
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                  Two of our most-loved tools, working side by side.
                </p>
              </motion.div>

              <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="group relative rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500"
                >
                  <div className="p-6 sm:p-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
                      <MessageSquare className="h-3.5 w-3.5" />
                      AI Chat
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
                      Your real estate copilot.
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-5">
                      Ask about any listing, market, or strategy — and get a structured Match Score backed by live data.
                    </p>
                    <Button asChild size="lg">
                      <a href="/chats">Start a chat</a>
                    </Button>
                  </div>
                  <div className="relative px-6 sm:px-8 pb-6 sm:pb-8">
                    <div className="absolute -inset-x-4 top-0 h-32 bg-gradient-to-b from-primary/10 to-transparent blur-2xl pointer-events-none" />
                    <img
                      src={chatFeatureImg}
                      alt="HomeLens AI chat answering a real estate question with a Match Score and key metrics"
                      loading="lazy"
                      width={1280}
                      height={896}
                      className="relative rounded-xl shadow-xl border border-border/50 w-full group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="group relative rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500"
                >
                  <div className="p-6 sm:p-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-medium mb-3">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Buying Power
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
                      Know exactly what you can afford.
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-5">
                      Plug in your income, debts, and down payment — see your max price, monthly breakdown, and affordability gauge in seconds.
                    </p>
                    <Button asChild size="lg" variant="outline">
                      <a href="/buying-power">Calculate now</a>
                    </Button>
                  </div>
                  <div className="relative px-6 sm:px-8 pb-6 sm:pb-8">
                    <div className="absolute -inset-x-4 top-0 h-32 bg-gradient-to-b from-secondary/10 to-transparent blur-2xl pointer-events-none" />
                    <img
                      src={buyingPowerImg}
                      alt="HomeLens buying-power calculator showing affordable price and monthly payment breakdown"
                      loading="lazy"
                      width={1280}
                      height={896}
                      className="relative rounded-xl shadow-xl border border-border/50 w-full group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Pricing Section */}
      {!hasStartedConversation && !user && <PricingSection />}

      {/* FAQ Section */}
      {!hasStartedConversation && !user &&
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

                <AccordionItem value="item-6" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-left">
                    How does the HomeLens Chrome Extension work?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-3">
                    <p>The HomeLens Chrome Extension brings AI-powered analysis directly to your browser while you browse listings on sites like Zillow, Redfin, and Realtor.com.</p>
                    <p>Once installed, it automatically detects when you're viewing a property listing and lets you:</p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                      <li>Get an instant AI analysis of the property with a single click</li>
                      <li>See a personalized Property Match Score (0-10) based on your profile</li>
                      <li>Ask follow-up questions about the property, neighborhood, schools, and more</li>
                      <li>All conversations are saved and synced with your HomeLens account</li>
                    </ul>
                    <p>Simply install the extension from the Chrome Web Store, log in with your HomeLens account, and start analyzing listings as you browse.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </motion.div>
          </div>
        </section>
      }

      {/* Footer */}
      {!hasStartedConversation && !user && <Footer />}
    </div>);

}