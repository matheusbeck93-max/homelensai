import { Button } from "@/components/ui/button";
import { Home, Bot, Send, Plus, History, Mic, MicOff, Search as SearchIcon, Bookmark, Trash2, Edit, Heart } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trackRateLimitError, trackApiError, trackValidationError } from "@/lib/sentry";
import { searchQuerySchema } from "@/lib/validation";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import InlineCalculator from "@/components/InlineCalculator";
import InlineDealAnalysis from "@/components/InlineDealAnalysis";
import { PropertyComparison } from "@/components/PropertyComparison";
import PropertyCarousel from "@/components/PropertyCarousel";
import { UIBlockRenderer } from "@/components/ui-blocks/UIBlockRenderer";
import { PropertyResultsCarousel } from "@/components/ui-blocks/PropertyResultsCarousel";
import { Navigation } from "@/components/Navigation";
import { UIBlock, HomeLensListing } from "@/types/ui-blocks";
import ReactMarkdown from "react-markdown";
import { isPropertySearchQuery, parsePropertySearchQuery } from "@/utils/propertySearchHelpers";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { HouseHeroAnimation } from "@/components/HouseHeroAnimation";
import heroBackground from "@/assets/american-house-hero.jpg";
import videoThumbnail from "@/assets/homelens-intro-thumbnail.jpg";
import { Play } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InstallPrompt } from "@/components/InstallPrompt";
import { useTypingPlaceholder } from "@/hooks/useTypingPlaceholder";
import { useToast } from "@/hooks/use-toast";
import { useComparison } from "@/contexts/ComparisonContext";
import { useSubscription } from "@/hooks/useSubscription";
import { ComparisonFloatingBar } from "@/components/comparison/ComparisonFloatingBar";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { MarketSnapshotCard, MarketSnapshot } from "@/components/MarketSnapshotCard";
import { useQuery } from "@tanstack/react-query";
const MarkdownLink = ({
  href,
  children
}: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
    {children}
  </a>;
export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedProperties, clearComparison } = useComparison();
  const { tier, userId } = useSubscription();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pastConversations, setPastConversations] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [searchProperties, setSearchProperties] = useState<HomeLensListing[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchLocation, setSearchLocation] = useState<string>("");
  const [showConversation, setShowConversation] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [editingSearchId, setEditingSearchId] = useState<string | null>(null);
  const [editingSearchName, setEditingSearchName] = useState<string>("");
  const [analyzedProperty, setAnalyzedProperty] = useState<HomeLensListing | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string>("");
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(null);
  const [searchParams, setSearchParams] = useState<any>(null); // For React Query caching
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const animatedPlaceholder = useTypingPlaceholder();
  
  // React Query for property search with caching (5 min stale time)
  const { data: cachedSearchData, isLoading: isSearchQueryLoading, error: searchQueryError } = useQuery({
    queryKey: ['property-search', searchParams],
    queryFn: async () => {
      if (!searchParams) return null;
      
      const { data, error } = await supabase.functions.invoke('search-listings', {
        body: searchParams
      });
      
      if (error) {
        // Handle specific error types
        if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
          trackRateLimitError('search-listings', 60);
          throw new Error('RATE_LIMIT_EXCEEDED');
        }
        if (error.message?.includes('Invalid input') || error.message?.includes('400')) {
          trackValidationError('search-listings', [error.message]);
          throw new Error('VALIDATION_ERROR');
        }
        // Track other API errors
        trackApiError('search-listings', 500, error.message, { searchParams });
        throw error;
      }
      
      return data;
    },
    enabled: !!searchParams,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
  });
  
  // Effect to process cached search data
  useEffect(() => {
    if (cachedSearchData && searchParams) {
      const processSearchResults = async () => {
        if (cachedSearchData.error) {
          const errorMsg = cachedSearchData.error + (cachedSearchData.details ? `: ${cachedSearchData.details}` : '');
          setSearchError(errorMsg);
          setSearchProperties([]);
          setMarketSnapshot(null);
          
          // Track specific error types to Sentry
          if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
            trackRateLimitError('search-listings', 60);
          } else if (errorMsg.includes('400') || errorMsg.includes('validation')) {
            trackValidationError('search-listings', [cachedSearchData.details || cachedSearchData.error]);
          } else {
            trackApiError('search-listings', 500, cachedSearchData.error, cachedSearchData);
          }
        } else if (cachedSearchData.listings && cachedSearchData.listings.length > 0) {
          // Enrich properties with RentCast & Census data
          const enrichedListings = await enrichProperties(cachedSearchData.listings);
          setSearchProperties(enrichedListings);
          setSearchError(null);
          
          // Fetch market snapshot for the search location
          const spec = searchParams;
          await fetchMarketSnapshot(spec.zip, spec.city, spec.state);
        } else {
          // Handle 0 results - try to suggest alternative locations
          const spec = searchParams;
          const relaxedSuggestions = [];
          if (spec.maxPrice) {
            const newMax = Math.round(spec.maxPrice * 1.15);
            relaxedSuggestions.push(`Try up to $${newMax.toLocaleString()}`);
          }
          if (spec.minBeds && spec.minBeds > 2) {
            relaxedSuggestions.push(`Include ${spec.minBeds - 1}+ bedroom properties`);
          }
          
          // Fetch location suggestions if we have a location
          if (spec.location) {
            fetchLocationSuggestions(spec.location);
          }
          
          const suggestionText = relaxedSuggestions.length > 0 
            ? ` Would you like me to: ${relaxedSuggestions.join(' or ')}?`
            : " Try adjusting your search criteria or searching a nearby area.";
          
          setSearchError("No properties found matching your exact criteria." + suggestionText);
          setSearchProperties([]);
          setMarketSnapshot(null);
        }
        setSearchLoading(false);
      };
      
      processSearchResults();
    }
  }, [cachedSearchData, searchParams]);
  
  // Effect to handle React Query errors
  useEffect(() => {
    if (searchQueryError) {
      let errorMessage = "Failed to search properties. Please try again.";
      const errorStr = String(searchQueryError);
      
      if ((searchQueryError as Error)?.message === 'RATE_LIMIT_EXCEEDED' || errorStr.includes('429') || errorStr.includes('rate limit')) {
        errorMessage = "Too many searches. Please wait about a minute and try again.";
        trackRateLimitError('search-listings', 60);
        toast({
          title: "Rate Limit Reached",
          description: "Please wait a minute before searching again.",
          variant: "destructive",
        });
      } else if ((searchQueryError as Error)?.message === 'VALIDATION_ERROR' || errorStr.includes('400') || errorStr.includes('validation')) {
        errorMessage = "Invalid search parameters. Please try a different query.";
        trackValidationError('search-listings', [errorStr]);
        toast({
          title: "Invalid Search",
          description: "Please adjust your search criteria and try again.",
          variant: "destructive",
        });
      } else if (errorStr.includes('500') || errorStr.includes('503')) {
        errorMessage = "Service temporarily unavailable. Please try again in a moment.";
        trackApiError('search-listings', 500, errorStr);
      } else if ((searchQueryError as Error)?.message) {
        errorMessage = (searchQueryError as Error).message;
        trackApiError('search-listings', 500, errorStr);
      }
      
      setSearchError(errorMessage);
      setSearchProperties([]);
      setMarketSnapshot(null);
      setSearchLoading(false);
    }
  }, [searchQueryError, toast]);
  
  // Enrich properties with RentCast and Census data
  const enrichProperties = async (listings: HomeLensListing[]): Promise<HomeLensListing[]> => {
    // Limit to first 10 properties to avoid API quota issues
    const propertiesToEnrich = listings.slice(0, 10);
    const remainingProperties = listings.slice(10);
    
    const enrichedPromises = propertiesToEnrich.map(async (property) => {
      try {
        // Only enrich if we have address and zip
        if (!property.address || !property.zip) {
          return property;
        }
        
        const { data, error } = await supabase.functions.invoke('enrich-property', {
          body: {
            address: property.address,
            city: property.city,
            state: property.state,
            zip: property.zip
          }
        });
        
        if (error || !data?.insights) {
          console.log('Enrichment skipped for', property.address);
          return property;
        }
        
        return {
          ...property,
          insights: data.insights
        };
      } catch (e) {
        console.log('Enrichment failed for', property.address, e);
        return property;
      }
    });
    
    const enriched = await Promise.all(enrichedPromises);
    return [...enriched, ...remainingProperties];
  };
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadPastConversations(session.user.id);
      }
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadPastConversations(session.user.id);
      }
    });

    // Check for checkout success
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      toast({
        title: "Subscription activated!",
        description: "Welcome to HomeLens Pro/Premium. Your subscription is now active.",
      });
      // Clean URL
      window.history.replaceState({}, '', '/');
      // Refresh subscription status
      const refreshSub = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.functions.invoke('check-subscription');
          window.location.reload();
        }
      };
      refreshSub();
    }

    return () => subscription.unsubscribe();
  }, []);
  const loadPastConversations = async (userId: string) => {
    const {
      data,
      error
    } = await supabase.from('conversations').select('*').eq('user_id', userId).order('updated_at', {
      ascending: false
    }).limit(10);
    if (!error && data) {
      setPastConversations(data);
    }
  };
  const loadConversation = async (convId: string) => {
    const {
      data,
      error
    } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', {
      ascending: true
    });
    if (!error && data) {
      setMessages(data.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
      setConversationId(convId);
    }
  };
  useEffect(() => {
    scrollRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };
  const startVoiceRecording = () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onstart = () => {
        setIsRecording(true);
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        // Auto-send after a brief delay
        setTimeout(() => {
          setInput(transcript);
          handleSend();
        }, 100);
      };
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please enable microphone permissions.');
        }
      };
      recognition.onend = () => {
        setIsRecording(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Error starting voice recording:', error);
      setIsRecording(false);
    }
  };
  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };
  const handleNewConversation = async () => {
    // Save current conversation if there are messages and user is signed in
    if (messages.length > 0 && user) {
      try {
        let currentConvId = conversationId;

        // Create conversation if it doesn't exist
        if (!currentConvId) {
          const {
            data: convData,
            error: convError
          } = await supabase.from('conversations').insert({
            user_id: user.id,
            title: messages[0]?.content?.substring(0, 50) || 'New Conversation'
          }).select().single();
          if (!convError && convData) {
            currentConvId = convData.id;
          }
        }

        // Save messages
        if (currentConvId) {
          const messagesToSave = messages.map(msg => ({
            conversation_id: currentConvId,
            role: msg.role,
            content: msg.content
          }));
          await supabase.from('messages').insert(messagesToSave);

          // Reload past conversations
          loadPastConversations(user.id);
        }
      } catch (error) {
        console.error('Error saving conversation:', error);
      }
    }

    // Clear current conversation
    setMessages([]);
    setInput("");
    setConversationId(null);
  };
  
  const [lastSearchSpec, setLastSearchSpec] = useState<any>(null);
  const [clarificationNeeded, setClarificationNeeded] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{location: string, reason: string}>>([]);

  const fetchLocationSuggestions = async (location: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-suggest-location', {
        body: { location }
      });
      
      if (error) {
        console.error('Location suggestions error:', error);
        return;
      }
      
      if (data?.suggestions && data.suggestions.length > 0) {
        setLocationSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to fetch location suggestions:', error);
    }
  };

  const handleLocationSuggestionClick = (suggestedLocation: string) => {
    // Clear previous suggestions
    setLocationSuggestions([]);
    setSearchError(null);
    
    // Trigger new search with suggested location
    const newQuery = searchQuery.replace(/(?:in|near|at|around)\s+[^,]+(?:,\s*\w+)?/i, `in ${suggestedLocation}`);
    handlePropertySearch(newQuery);
  };

  const handlePropertySearch = async (query: string) => {
    setSearchLoading(true);
    setSearchError(null);
    setClarificationNeeded(null);
    setLocationSuggestions([]);
    setSearchQuery(query);
    setShowConversation(false);
    
    try {
      // Step 1: Try direct parser first (faster, no AI needed)
      const parsedParams = parsePropertySearchQuery(query);
      
      if (parsedParams.isValid && parsedParams.location) {
        console.log('Using direct parser:', parsedParams);
        
        // Validate prices
        if (parsedParams.minPrice && parsedParams.maxPrice && parsedParams.minPrice > parsedParams.maxPrice) {
          [parsedParams.minPrice, parsedParams.maxPrice] = [parsedParams.maxPrice, parsedParams.minPrice];
        }
        
        // Check for unrealistically low prices
        if (parsedParams.maxPrice && parsedParams.maxPrice < 10000) {
          setClarificationNeeded(`Did you mean $${(parsedParams.maxPrice * 1000).toLocaleString()}? Please clarify your budget.`);
          setSearchLoading(false);
          return;
        }
        
        // Use parsed params directly
        setSearchLocation(parsedParams.location);
        setLastSearchSpec(parsedParams);
        
        setSearchParams({
          location: parsedParams.location,
          minPrice: parsedParams.minPrice,
          maxPrice: parsedParams.maxPrice,
          minBeds: parsedParams.minBeds,
          maxBeds: parsedParams.maxBeds,
          minBaths: parsedParams.minBaths,
          propertyType: parsedParams.propertyType || 'any',
        });
        
        return; // Success - React Query will handle the search
      }
      
      // Step 2: Fallback to AI if direct parser didn't find valid location
      const userProfile = {
        preferredArea: preferredArea,
        persona: tier === 'premium' ? 'investor' : 'first_time_buyer',
        budgetMax: null
      };

      const { data: specData, error: specError } = await supabase.functions.invoke('ai-build-search-spec', {
        body: {
          query,
          lastSearchSpec,
          userProfile
        }
      });
      
      if (specError) throw specError;
      
      console.log('Search spec:', specData);
      
      // Step 2: Handle clarification
      if (specData.needs_clarification) {
        setClarificationNeeded(specData.clarification_question);
        setSearchLoading(false);
        return;
      }
      
      // Step 3: Handle non-search intents
      if (specData.intent !== 'property_search') {
        setSearchError("I can help you with that through the chat assistant. Try asking me in the chat!");
        setSearchLoading(false);
        return;
      }
      
      const spec = specData.search_spec;
      
      // Step 4: Validate search spec
      if (!spec.city && !spec.state && !spec.zip) {
        setClarificationNeeded("Which city and state (or ZIP code) should I search in?");
        setSearchLoading(false);
        return;
      }
      
      // Swap prices if backwards
      if (spec.minPrice && spec.maxPrice && spec.minPrice > spec.maxPrice) {
        [spec.minPrice, spec.maxPrice] = [spec.maxPrice, spec.minPrice];
      }
      
      // Check for unrealistic prices
      if (spec.maxPrice && spec.maxPrice < 10000) {
        setClarificationNeeded("Did you mean $" + (spec.maxPrice * 1000).toLocaleString() + "? Please clarify your budget.");
        setSearchLoading(false);
        return;
      }
      
      // Store search spec for next query
      setLastSearchSpec(spec);
      
      // Build location string
      const location = spec.zip || `${spec.city}, ${spec.state}`;
      setSearchLocation(location);
      
      // Step 5: Trigger React Query search with caching
      setSearchParams({
        location,
        minPrice: spec.minPrice,
        maxPrice: spec.maxPrice,
        minBeds: spec.minBeds,
        maxBeds: spec.maxBeds,
        minBaths: spec.minBaths,
        propertyType: spec.propertyType || 'any',
        // Include for market snapshot
        zip: spec.zip,
        city: spec.city,
        state: spec.state,
      });
      
    } catch (error: any) {
      console.error('Search spec error:', error);
      
      // Handle errors from ai-build-search-spec
      let errorMessage = "Failed to process search. Please try again.";
      
      if (error?.message) {
        errorMessage = error.message;
      }
      
      // Try to extract location from query for suggestions
      const parsedParams = parsePropertySearchQuery(query);
      if (parsedParams.location) {
        fetchLocationSuggestions(parsedParams.location);
      }
      
      setSearchError(errorMessage);
      setSearchProperties([]);
      setMarketSnapshot(null);
      setSearchLoading(false);
    }
  };
  
  const fetchMarketSnapshot = async (zip?: string, city?: string, state?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('market-snapshot', {
        body: {
          location: {
            zip: zip || undefined,
            city: city || undefined,
            state: state || undefined
          }
        }
      });
      
      if (error) {
        console.error('Market snapshot error:', error);
        setMarketSnapshot(null);
        return;
      }
      
      if (data?.snapshot) {
        setMarketSnapshot(data.snapshot);
      } else {
        setMarketSnapshot(null);
      }
    } catch (error) {
      console.error('Market snapshot error:', error);
      setMarketSnapshot(null);
    }
  };
  
  const handlePropertyAnalyze = async (property: HomeLensListing) => {
    setAnalyzedProperty(property);
    setShowConversation(true);
    
    const userMessage = { 
      role: "user", 
      content: `Analyze this property at ${property.address}, ${property.city}, ${property.state}` 
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    
    try {
      // Build structured listing data from HomeLensListing
      // Note: Many fields are not available in the current HomeLensListing type
      const listing = {
        id: property.id || null,
        address_line: property.address || null,
        city: property.city || null,
        state: property.state || null,
        zip: property.zip || null,
        price: property.price || null,
        beds: property.beds || null,
        baths: property.baths || null,
        sqft: property.sqft || null,
        lot_sqft: null, // Not available in current type
        hoa_monthly: null, // Not available in current type
        property_type: null, // Not available in current type
        year_built: null, // Not available in current type
        status: property.status || null,
        days_on_market: null, // Not available in current type
        url: property.listingUrl || null,
        taxes_annual: null,
        description_raw: null,
        insights: property.insights || undefined // Include insights if available
      };
      
      const userContext = {
        persona: tier === 'premium' ? 'investor' : (tier === 'pro' ? 'move_up_buyer' : 'first_time_buyer'),
        time_horizon_years: null,
        budget_max: null,
        down_payment_pct: 20,
        interest_rate_pct: 6.5,
        goal: null
      };
      
      const { data, error } = await supabase.functions.invoke("ai-analyze-property", {
        body: { 
          source: "realty_in_us",
          listing,
          userContext,
          userId: userId || null,
          userTier: tier || 'free'
        }
      });
      
      if (error) throw error;
      
      // Check if limit was reached
      if (data?.limitReached) {
        toast({
          title: "Daily Limit Reached",
          description: data.message || "Upgrade to Pro for unlimited analyses",
          variant: "destructive"
        });
        setMessages(prev => prev.slice(0, -1)); // Remove user message
        return;
      }
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.analysis || "Analysis complete."
      }]);
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze this property. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    // Validate input
    try {
      searchQuerySchema.parse({ query: input });
    } catch (error: any) {
      toast({
        title: "Invalid Input",
        description: error.errors?.[0]?.message || "Please enter a valid search query",
        variant: "destructive"
      });
      return;
    }

    // Check if this looks like a property search query
    if (isPropertySearchQuery(input)) {
      await handlePropertySearch(input);
      setInput("");
      return;
    }
    
    // For non-search queries, show conversation box and continue chat
    setShowConversation(true);
    const userMessage = {
      role: "user",
      content: input
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [...messages, userMessage]
        }
      });
      if (error) throw error;
      let toolType, toolData, uiBlock;
      let cleanedResponse = data.response;
      
      // Try to parse JSON response for tools or UI blocks
      try {
        const jsonResponse = JSON.parse(data.response);
        
        // Check for UI block
        if (jsonResponse.type && jsonResponse.type.startsWith('ui_block/')) {
          uiBlock = jsonResponse as UIBlock;
          cleanedResponse = jsonResponse.message || '';
        }
        // Check for legacy tool format
        else if (jsonResponse.type) {
          toolType = jsonResponse.type;
          toolData = jsonResponse.data;
          cleanedResponse = jsonResponse.message || '';
        }
      } catch {
        // Not JSON, regular response
      }
      setMessages(prev => [...prev, {
        role: "assistant",
        content: cleanedResponse,
        toolType,
        toolData,
        uiBlock
      }]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  const [featuredListings, setFeaturedListings] = useState<HomeLensListing[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [preferredArea, setPreferredArea] = useState<string | null>(null);
  const [effectiveArea, setEffectiveArea] = useState<string>("");
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [areaInput, setAreaInput] = useState("");
  
  const DEFAULT_AREA = "Miami, FL";

  // Load preferred area from localStorage on mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("homelens_preferred_area");
      if (stored) {
        setPreferredArea(stored);
        setAreaInput(stored);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  // Load featured homes based on search location, preferred area, or default
  useEffect(() => {
    const loadFeaturedHomes = async () => {
      setFeaturedLoading(true);
      setFeaturedError(null);
      try {
        // Priority: searchLocation > preferredArea > DEFAULT_AREA
        const primaryLocation = searchLocation || preferredArea || DEFAULT_AREA;

        // First attempt: preferred area (or default if user hasn't set one)
        const firstPayload = {
          location: primaryLocation,
          minPrice: 0,
          maxPrice: 2000000,
        };

        const first = await supabase.functions.invoke("search-listings", {
          body: firstPayload,
        });

        if (first.error) {
          setFeaturedError(first.error.message ?? "Unable to load featured homes.");
          setFeaturedListings([]);
          setEffectiveArea("");
          return;
        }

        if (first.data?.error) {
          setFeaturedError(first.data.error);
          setFeaturedListings([]);
          setEffectiveArea("");
          return;
        }

        const firstListings = first.data?.listings ?? [];

        if (firstListings.length > 0) {
          const enriched = await enrichProperties(firstListings);
          setFeaturedListings(enriched);
          setEffectiveArea(primaryLocation);
          return;
        }

        // If searchLocation or preferred area returned 0 listings,
        // try one more time with DEFAULT_AREA as a fallback (only if not already using default)
        if (primaryLocation !== DEFAULT_AREA) {
          const fallback = await supabase.functions.invoke("search-listings", {
            body: {
              location: DEFAULT_AREA,
              minPrice: 0,
              maxPrice: 2000000,
            },
          });

          if (fallback.error) {
            setFeaturedError(
              fallback.error.message ?? "Unable to load featured homes."
            );
            setFeaturedListings([]);
            setEffectiveArea("");
            return;
          }

          if (fallback.data?.error) {
            setFeaturedError(fallback.data.error);
            setFeaturedListings([]);
            setEffectiveArea("");
            return;
          }

          const fallbackListings = fallback.data?.listings ?? [];
          const enriched = await enrichProperties(fallbackListings);
          setFeaturedListings(enriched);
          setEffectiveArea(DEFAULT_AREA);
          return;
        }

        // If no preferred area or both attempts returned zero listings
        setFeaturedListings([]);
        setEffectiveArea("");
      } catch (error) {
        console.error('Error loading featured homes:', error);
        setFeaturedError('Failed to load featured homes. Please try a search above.');
        setEffectiveArea("");
      } finally {
        setFeaturedLoading(false);
      }
    };
    
    loadFeaturedHomes();
  }, [preferredArea, searchLocation]); // Re-run when searchLocation changes
  
  const handleSaveArea = () => {
    const value = areaInput.trim();
    if (!value) return;
    setPreferredArea(value);
    try {
      window.localStorage.setItem("homelens_preferred_area", value);
    } catch {}
    setShowAreaDialog(false);
  };

  const loadSavedSearches = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setSavedSearches(data);
    }
  };

  const handleSaveSearch = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save searches",
        variant: "destructive"
      });
      return;
    }
    
    if (!searchQuery) return;
    
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user.id,
      query_text: searchQuery,
      filters_json: { location: searchLocation }
    });
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to save search",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Search saved successfully"
      });
      loadSavedSearches();
    }
  };

  const handleDeleteSearch = async (searchId: string) => {
    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', searchId);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete search",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Search deleted"
      });
      loadSavedSearches();
    }
  };

  const handleRenameSearch = async (searchId: string, newName: string) => {
    const { error } = await supabase
      .from('saved_searches')
      .update({ query_text: newName })
      .eq('id', searchId);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to rename search",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Search renamed"
      });
      loadSavedSearches();
      setEditingSearchId(null);
      setEditingSearchName("");
    }
  };

  const handleLoadSavedSearch = (search: any) => {
    handlePropertySearch(search.query_text);
    setShowSavedSearches(false);
  };

  useEffect(() => {
    if (user) {
      loadSavedSearches();
    }
  }, [user]);

  return <div className="min-h-screen pb-24 md:pb-8">
      {/* Navigation - Import from component */}
      <Navigation />

      {/* Hero Section with Search */}
      <section className="relative w-full flex items-center justify-center overflow-hidden pt-20 pb-4 sm:pt-24 sm:pb-6">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-muted animate-gradient-shift" />
        
        {/* Content */}
        <main className="relative z-10 w-full max-w-5xl mx-auto px-4 space-y-4 sm:space-y-6">
          <div className="w-full">
            <div className="text-center space-y-6 sm:space-y-8">
              {/* SVG House Animation */}
              <HouseHeroAnimation />
               
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-8 sm:mb-12 animate-fade-up px-2">
                Find your new home
              </h1>
              
              <div className="bg-card border rounded-2xl p-4 sm:p-6 shadow-md w-full max-w-full">
                <Textarea 
                  placeholder={animatedPlaceholder}
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
                  className="min-h-[80px] sm:min-h-[100px] mb-4 text-sm sm:text-base" 
                  disabled={searchLoading}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={isRecording ? stopVoiceRecording : startVoiceRecording} disabled={loading || searchLoading} variant={isRecording ? "destructive" : "outline"} size="lg" className={`w-full sm:w-auto ${isRecording ? "animate-pulse" : ""}`}>
                    {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>
                  <Button onClick={handleSend} disabled={loading || searchLoading} className="flex-1">
                    {searchLoading ? (
                      <>
                        <SearchIcon className="h-4 w-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Search Properties
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </section>

      {/* Search Results Section */}
      {(searchProperties.length > 0 || searchLoading || searchError) && (
        <section className="container mx-auto px-4 py-6 sm:py-8">
          <div className="space-y-4 sm:space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                {searchQuery ? `Search Results for "${searchQuery}"` : "Search Results"}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {searchProperties.length > 0 && `Found ${searchProperties.length} properties`}
              </p>
            </div>
            
            {/* Search Error Alert */}
            {searchError && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{searchError}</AlertDescription>
                </Alert>
                
                {/* Location Suggestions "Did you mean?" */}
                {locationSuggestions.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-3">
                        <p className="font-semibold text-sm">Did you mean one of these locations?</p>
                        <div className="flex flex-wrap gap-2">
                          {locationSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleLocationSuggestionClick(suggestion.location)}
                              className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
                              title={suggestion.reason}
                            >
                              {suggestion.location}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Click a location to search there instead
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            {/* Clarification Message */}
            {clarificationNeeded && (
              <Alert>
                <Bot className="h-4 w-4" />
                <AlertDescription>
                  <strong>Need more information:</strong> {clarificationNeeded}
                </AlertDescription>
              </Alert>
            )}
            
            {/* Market Snapshot Card */}
            {marketSnapshot && (marketSnapshot.hasRentcastData || marketSnapshot.hasCensusData) && (
              <div className="mb-6">
                <MarketSnapshotCard
                  snapshot={marketSnapshot}
                  subscriptionStatus={tier || "free"}
                  onUpgradeClick={() => {
                    setUpgradeReason("Unlock full market insights including rent trends, demographics, and investment metrics");
                    setUpgradeModalOpen(true);
                  }}
                />
              </div>
            )}
            
            {/* Loading Skeleton */}
            {searchLoading && (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-[90vw] max-w-[320px] flex-shrink-0">
                    <Skeleton className="h-48 w-full mb-4" />
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            )}
            
            {/* Property Search Results */}
            {searchProperties.length > 0 && !searchLoading && (
              <PropertyResultsCarousel
                title="Property Search Results"
                properties={searchProperties}
                onAnalyze={handlePropertyAnalyze}
              />
            )}
          </div>
        </section>
      )}

      {/* Featured Homes Section - Show based on search or default location */}
      <section className="container mx-auto px-4 py-4 mt-3 md:mt-4">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                {effectiveArea
                  ? `Featured Homes near ${effectiveArea}`
                  : "Featured Homes"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Handpicked properties in your area
              </p>
                {featuredError && (
                  <p className="text-sm text-red-500 mt-2">{featuredError}</p>
                )}
              </div>
              <button
                type="button"
                className="text-sm text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  setAreaInput(preferredArea || "");
                  setShowAreaDialog(true);
                }}
              >
                Set your area
              </button>
            </div>
            
            {featuredLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-[90vw] max-w-[320px] flex-shrink-0">
                    <Skeleton className="h-48 w-full mb-4 rounded-lg" />
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : featuredListings.length > 0 ? (
              <PropertyResultsCarousel
                title={
                  effectiveArea
                    ? `Homes near ${effectiveArea}`
                    : "Homes in featured market"
                }
                properties={featuredListings}
                onAnalyze={handlePropertyAnalyze}
              />
            ) : (
              <Alert>
                <AlertDescription>
                  <span className="inline-flex items-center gap-2">
                    <span>ⓘ</span>
                    <span>
                      No featured homes available for this area right now. Try adjusting
                      your preferred area or use the search box above.
                    </span>
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </section>

      {/* Floating Conversation Box */}
      {showConversation && (
        <div className="fixed bottom-4 right-4 w-full max-w-md z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-card border rounded-2xl shadow-2xl flex flex-col h-[600px]">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
              <h3 className="font-semibold flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Property Analysis
              </h3>
              <div className="flex items-center gap-1">
                {analyzedProperty && (
                  <FavoriteButton 
                    propertyId={analyzedProperty.id} 
                    userId={user?.id} 
                    variant="icon"
                    position="relative"
                  />
                )}
                {searchQuery && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSaveSearch}
                    className="h-8 w-8 p-0"
                    title="Save current search"
                  >
                    <Bookmark className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowSavedSearches(true)}
                  className="h-8 w-8 p-0"
                  title="View saved searches"
                >
                  <History className="h-4 w-4" />
                  </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleNewConversation}
                  className="h-8 w-8 p-0"
                  title="New conversation"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowConversation(false)}
                  className="h-8 w-8 p-0"
                  title="Minimize"
                >
                  ×
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4 pb-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <Bot className="h-12 w-12 mb-4 text-primary" />
                    <p className="text-sm">Start a conversation by clicking "Analyze" on any property or ask a question below.</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => (
                      <div key={i}>
                    {/* Render UI Block if present */}
                    {msg.role === 'assistant' && msg.uiBlock && (
                      <div className="mb-4">
                        <UIBlockRenderer 
                          block={msg.uiBlock}
                          onPropertyAnalyze={handlePropertyAnalyze}
                        />
                      </div>
                    )}
                    
                    {/* Message content */}
                    <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <Bot className="h-5 w-5 text-primary-foreground" />
                        </div>
                      )}
                      <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <ReactMarkdown components={{ a: MarkdownLink }}>{msg.content}</ReactMarkdown>
                        {msg.toolType === 'calculator' && <InlineCalculator />}
                        {msg.toolType === 'deal_analysis' && <InlineDealAnalysis initialData={msg.toolData} />}
                        {msg.toolType === 'property_comparison' && msg.toolData && (
                          <div className="mt-4">
                            <PropertyComparison properties={msg.toolData} onRemove={() => {}} onClear={() => {}} />
                          </div>
                        )}
                      </div>
                      </div>
                    </div>
                  ))}
                  {loading && <div className="text-muted-foreground text-sm">Thinking...</div>}
                  </>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t flex gap-2 flex-shrink-0">
              <Textarea 
                placeholder="Ask a follow-up question..." 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
                className="min-h-[60px] flex-1" 
                disabled={loading}
              />
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={isRecording ? stopVoiceRecording : startVoiceRecording} 
                  disabled={loading} 
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  className={isRecording ? "animate-pulse" : ""}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button onClick={handleSend} disabled={loading} size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Property Analysis Button - Always accessible */}
      {!showConversation && (
        <Button
          onClick={() => setShowConversation(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full h-14 w-14 shadow-2xl"
          size="lg"
          title="Open Property Analysis"
        >
          <Home className="h-6 w-6" />
        </Button>
      )}

      {/* Footer */}
      <footer className="bg-muted py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 HomeLens. All rights reserved.</p>
        </div>
      </footer>
      
      {/* Set Area Dialog */}
      <Dialog open={showAreaDialog} onOpenChange={setShowAreaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Your Area</DialogTitle>
            <DialogDescription>
              Enter a city and state (e.g., "Arlington, VA") or a ZIP code to
              see homes near you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="City, State or ZIP"
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveArea();
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAreaDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveArea}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Saved Searches Dialog */}
      <Dialog open={showSavedSearches} onOpenChange={setShowSavedSearches}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Saved Searches</DialogTitle>
            <DialogDescription>
              Manage and load your saved property searches
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {savedSearches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No saved searches yet</p>
                  <p className="text-sm mt-2">Save a search to access it here later</p>
                </div>
              ) : (
                savedSearches.map((search) => (
                  <div key={search.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex-1">
                      {editingSearchId === search.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editingSearchName}
                            onChange={(e) => setEditingSearchName(e.target.value)}
                            placeholder="Search name"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleRenameSearch(search.id, editingSearchName);
                              }
                            }}
                          />
                          <Button size="sm" onClick={() => handleRenameSearch(search.id, editingSearchName)}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditingSearchId(null);
                            setEditingSearchName("");
                          }}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium">{search.query_text}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(search.created_at).toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>
                    {editingSearchId !== search.id && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingSearchId(search.id);
                            setEditingSearchName(search.query_text);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleLoadSavedSearch(search)}
                        >
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteSearch(search.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Comparison Floating Bar */}
      <ComparisonFloatingBar />
      
      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => {
          setUpgradeModalOpen(false);
          setUpgradeReason("");
        }}
        feature="Market Insights"
        reason={upgradeReason || "Upgrade to unlock powerful features"}
      />
    </div>;
}
