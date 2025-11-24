import { Button } from "@/components/ui/button";
import { Home, Bot, Send, Plus, History, Mic, MicOff, Search as SearchIcon, Bookmark, Trash2, Edit, Heart } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
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
import { ComparisonResults } from "@/components/comparison/ComparisonResults";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { canRunComparison, incrementComparisonCount } from "@/lib/comparisonUtils";
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
  const [comparisonResults, setComparisonResults] = useState<string | null>(null);
  const [comparingProperties, setComparingProperties] = useState<HomeLensListing[]>([]);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const animatedPlaceholder = useTypingPlaceholder();
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

  const handlePropertySearch = async (query: string) => {
    setSearchLoading(true);
    setSearchError(null);
    setClarificationNeeded(null);
    setSearchQuery(query);
    setShowConversation(false);
    
    try {
      // Step 1: Build search spec using AI
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
      
      // Step 5: Call search-listings with validated params
      const { data, error } = await supabase.functions.invoke('search-listings', {
        body: {
          location,
          minPrice: spec.minPrice,
          maxPrice: spec.maxPrice,
          minBeds: spec.minBeds,
          maxBeds: spec.maxBeds,
          minBaths: spec.minBaths,
          propertyType: spec.propertyType || 'any'
        }
      });
      
      if (error) throw error;
      
      if (data?.error) {
        setSearchError(data.error + (data.details ? `: ${data.details}` : ''));
        setSearchProperties([]);
      } else if (data?.listings && data.listings.length > 0) {
        // TODO: Add persona-based re-ranking here
        setSearchProperties(data.listings);
        setSearchError(null);
      } else {
        // Handle 0 results with relaxation suggestions
        const relaxedSuggestions = [];
        if (spec.maxPrice) {
          const newMax = Math.round(spec.maxPrice * 1.15);
          relaxedSuggestions.push(`Try up to $${newMax.toLocaleString()}`);
        }
        if (spec.minBeds && spec.minBeds > 2) {
          relaxedSuggestions.push(`Include ${spec.minBeds - 1}+ bedroom properties`);
        }
        
        const suggestionText = relaxedSuggestions.length > 0 
          ? ` Would you like me to: ${relaxedSuggestions.join(' or ')}?`
          : " Try adjusting your search criteria.";
        
        setSearchError("No properties found matching your exact criteria." + suggestionText);
        setSearchProperties([]);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      const errorMessage = error?.message || "Failed to search properties. Please try again.";
      setSearchError(errorMessage);
      setSearchProperties([]);
    } finally {
      setSearchLoading(false);
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
        description_raw: null
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
          userContext
        }
      });
      
      if (error) throw error;
      
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
          setFeaturedListings(firstListings);
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
          setFeaturedListings(fallbackListings);
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

  const handleCompare = async () => {
    if (selectedProperties.length < 2) {
      toast({
        title: "Not enough properties",
        description: "Select at least 2 properties to compare",
        variant: "destructive"
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to use property comparison",
        variant: "destructive"
      });
      navigate('/auth');
      return;
    }

    // Check subscription access
    const { canRun, reason } = await canRunComparison(userId, tier);
    
    if (!canRun) {
      setUpgradeReason(reason || "Upgrade to Pro for unlimited property comparisons");
      setUpgradeModalOpen(true);
      return;
    }

    // Run comparison
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('compare-properties', {
        body: { properties: selectedProperties }
      });

      if (error) throw error;

      if (data.analysis) {
        setComparisonResults(data.analysis);
        setComparingProperties([...selectedProperties]);
        
        // Increment comparison count for free users
        if (tier === 'free') {
          incrementComparisonCount(userId);
        }
      }
    } catch (error: any) {
      console.error('Comparison error:', error);
      toast({
        title: "Comparison failed",
        description: error.message || "Failed to generate comparison",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseComparison = () => {
    setComparisonResults(null);
    setComparingProperties([]);
    clearComparison();
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
      <section className="relative w-full flex items-center justify-center overflow-hidden pt-24 pb-6">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-muted animate-gradient-shift" />
        
        {/* Content */}
        <main className="relative z-10 max-w-5xl mx-auto px-4 w-full space-y-6">
          <div className="w-full">
            <div className="text-center space-y-8">
              {/* SVG House Animation */}
              <HouseHeroAnimation />
               
              <h1 className="text-5xl font-bold text-foreground mb-12 animate-fade-up">
                Find your new home
              </h1>
              
              <div className="bg-card border rounded-2xl p-6 shadow-md">
                <Textarea 
                  placeholder={animatedPlaceholder}
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
                  className="min-h-[100px] mb-4" 
                  disabled={searchLoading}
                />
                <div className="flex gap-2">
                  <Button onClick={isRecording ? stopVoiceRecording : startVoiceRecording} disabled={loading || searchLoading} variant={isRecording ? "destructive" : "outline"} size="lg" className={isRecording ? "animate-pulse" : ""}>
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
        <section className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">
                {searchQuery ? `Search Results for "${searchQuery}"` : "Search Results"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {searchProperties.length > 0 && `Found ${searchProperties.length} properties`}
              </p>
            </div>
            
            {/* Search Error Alert */}
            {searchError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
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
      <ComparisonFloatingBar onCompare={handleCompare} />
      
      {/* Comparison Results Modal */}
      {comparisonResults && (
        <ComparisonResults
          properties={comparingProperties}
          analysis={comparisonResults}
          onClose={handleCloseComparison}
        />
      )}
      
      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature="Property Comparison"
        reason={upgradeReason}
      />
    </div>;
}
