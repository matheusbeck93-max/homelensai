import { Button } from "@/components/ui/button";
import { Home, Bot, Send, Plus, History, Mic, MicOff, Search as SearchIcon } from "lucide-react";
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
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { UIBlock, HomeLensListing } from "@/types/ui-blocks";
import ReactMarkdown from "react-markdown";
import { isPropertySearchQuery, parsePropertySearchQuery } from "@/utils/propertySearchHelpers";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import heroBackground from "@/assets/american-house-hero.jpg";
import videoThumbnail from "@/assets/homelens-intro-thumbnail.jpg";
import { Play } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InstallPrompt } from "@/components/InstallPrompt";
import { useTypingPlaceholder } from "@/hooks/useTypingPlaceholder";
import { useToast } from "@/hooks/use-toast";
const MarkdownLink = ({
  href,
  children
}: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
    {children}
  </a>;
export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
  
  const handlePropertySearch = async (query: string) => {
    setSearchLoading(true);
    setSearchError(null);
    
    try {
      // Parse the query using helper
      const params = parsePropertySearchQuery(query);
      
      if (!params.location) {
        setSearchError("Please specify a location in your search (e.g., 'in Austin, TX')");
        setSearchLoading(false);
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('search-listings', {
        body: params
      });
      
      if (error) throw error;
      
      if (data?.error) {
        // Handle backend error responses
        setSearchError(data.error + (data.details ? `: ${data.details}` : ''));
        setSearchProperties([]);
      } else if (data?.listings && data.listings.length > 0) {
        setSearchProperties(data.listings);
        setSearchError(null);
        
        // Create synthetic assistant message with UI block
        const syntheticMessage = {
          role: "assistant",
          content: `Here are ${data.listings.length} properties matching your criteria. Click "Analyze" on any property to get detailed insights.`,
          uiBlock: {
            type: "ui_block/property_results_carousel" as const,
            title: "Property Search Results",
            properties: data.listings
          }
        };
        
        setMessages([
          { role: "user", content: query },
          syntheticMessage
        ]);
      } else {
        setSearchError("No properties found. Try adjusting your search criteria.");
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
    if (!property.listingUrl) {
      toast({
        title: "Cannot Analyze",
        description: "This property doesn't have a listing URL available.",
        variant: "destructive"
      });
      return;
    }
    
    // Create analysis message
    const analysisMessage = `Analyze this property: ${property.listingUrl}`;
    setInput(analysisMessage);
    
    // Add user message
    const userMessage = { role: "user", content: analysisMessage };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [...messages, userMessage] }
      });
      
      if (error) throw error;
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response || "Analysis complete."
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

    // Check if this looks like a property search query (only on first message)
    if (messages.length === 0 && isPropertySearchQuery(input)) {
      await handlePropertySearch(input);
      return;
    }
    
    // If we already have messages, continue in chat mode
    if (messages.length === 0) {
      // Otherwise redirect to chat for AI conversation
      navigate('/chat', {
        state: {
          initialPrompt: input,
          newConversation: true
        }
      });
      return;
    }
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
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Try to get user's geolocation on mount
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation not supported, using a default city.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lon: longitude });
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setLocationError(err.message || "Unable to access location, using a default city.");
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 600000,
      }
    );
  }, []);

  // Load featured homes based on user location or default
  useEffect(() => {
    const loadFeaturedHomes = async () => {
      setFeaturedLoading(true);
      setFeaturedError(null);
      try {
        const payload: any = {};

        if (userLocation) {
          // Use user's coordinates if available
          payload.latitude = userLocation.lat;
          payload.longitude = userLocation.lon;
        } else {
          // Fallback to default city
          payload.location = "Miami, FL";
          payload.minPrice = 300000;
          payload.maxPrice = 1500000;
          payload.minBeds = 2;
        }

        const { data, error } = await supabase.functions.invoke('search-listings', {
          body: payload
        });
        
        if (error) {
          console.error('Featured homes API error:', error);
          setFeaturedError('Unable to load featured homes right now.');
          return;
        }
        
        if (data?.error) {
          console.error('Featured homes backend error:', data.error);
          setFeaturedError(data.error);
          return;
        }
        
        if (data?.listings && data.listings.length > 0) {
          setFeaturedListings(data.listings.slice(0, 6));
        } else {
          setFeaturedError('No featured homes available at the moment.');
        }
      } catch (error) {
        console.error('Error loading featured homes:', error);
        setFeaturedError('Failed to load featured homes. Please try a search above.');
      } finally {
        setFeaturedLoading(false);
      }
    };
    
    loadFeaturedHomes();
  }, [userLocation]);

  return <div className="min-h-screen pb-24 md:pb-8">
      {/* Navigation - Import from component */}
      <Navigation />

      {/* Hero Section with Search */}
      <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-muted pt-20 pb-10">
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {messages.length === 0 ? <div className="text-center space-y-8">
                <h1 className="text-5xl font-bold text-foreground mb-12">
                  Find your new home
                </h1>
                
                {/* Search Error Alert */}
                {searchError && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{searchError}</AlertDescription>
                  </Alert>
                )}
                
                {/* Loading Skeleton */}
                {searchLoading && (
                  <div className="mb-8 space-y-4">
                    <div className="flex gap-4 overflow-x-auto pb-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="w-[90vw] max-w-[320px] flex-shrink-0">
                          <Skeleton className="h-48 w-full mb-4" />
                          <Skeleton className="h-6 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Property Search Results - DEPRECATED: Now using UIBlockRenderer */}
                {/* This PropertyCarousel is kept for backwards compatibility but 
                    new searches use the UIBlockRenderer with property_results_carousel block */}
                {searchProperties.length > 0 && messages.length === 0 && (
                  <div className="mb-8">
                    <PropertyCarousel 
                      properties={searchProperties}
                      onSelectProperty={handlePropertyAnalyze}
                    />
                  </div>
                )}
                
                <div className="bg-card border rounded-2xl p-6 shadow-md">
                  <Textarea 
                    placeholder={searchProperties.length > 0 ? "Ask about these properties or search again..." : animatedPlaceholder}
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
                          {searchProperties.length > 0 ? "Ask HomeLens" : "Search Properties"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div> : <div className="bg-card border rounded-2xl p-6 h-[85vh] flex flex-col shadow-lg">
                <div className="flex justify-between items-center mb-4 pb-4 border-b">
                  <h2 className="text-lg font-semibold">Conversation</h2>
                  <Button variant="outline" size="sm" onClick={handleNewConversation}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Chat
                  </Button>
                </div>
                <ScrollArea className="flex-1 min-h-0 pr-4">
                  <div className="space-y-4">
                     {messages.map((msg, i) => (
                       <div key={i}>
                         {/* Render UI Block if present (above the message) */}
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
                           {msg.role === 'assistant' && <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                               <Bot className="h-5 w-5 text-primary-foreground" />
                             </div>}
                           <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                             <ReactMarkdown components={{
                         a: MarkdownLink
                       }}>{msg.content}</ReactMarkdown>
                             {msg.toolType === 'calculator' && <InlineCalculator />}
                             {msg.toolType === 'deal_analysis' && <InlineDealAnalysis initialData={msg.toolData} />}
                             {msg.toolType === 'property_comparison' && msg.toolData && <div className="mt-4">
                                 <PropertyComparison properties={msg.toolData} onRemove={() => {}} onClear={() => {}} />
                               </div>}
                           </div>
                         </div>
                       </div>
                     ))}
                    {loading && <div className="text-muted-foreground">Thinking...</div>}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>
                <div className="mt-4 flex gap-2">
                  <Textarea placeholder="Follow up question..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} className="flex-1" />
                  <Button onClick={isRecording ? stopVoiceRecording : startVoiceRecording} disabled={loading} variant={isRecording ? "destructive" : "outline"} className={isRecording ? "animate-pulse" : ""}>
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button onClick={handleSend} disabled={loading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>}
          </div>
        </div>
      </section>

      {/* Featured Homes Section */}
      {messages.length === 0 && (
        <section className="container mx-auto px-4 py-10 mt-10 border-t border-muted">
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold">
                {userLocation ? "Featured Homes near you" : "Featured Homes in Miami"}
              </h2>
              {locationError && (
                <p className="text-sm text-muted-foreground mt-2">
                  {locationError} Showing homes in a default market instead.
                </p>
              )}
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
            ) : featuredError ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{featuredError}</AlertDescription>
              </Alert>
            ) : featuredListings.length > 0 ? (
              <PropertyResultsCarousel
                title={userLocation ? "Homes near you" : "Featured Listings in Miami"}
                properties={featuredListings}
                onAnalyze={handlePropertyAnalyze}
              />
            ) : (
              <Alert>
                <AlertDescription>
                  No featured homes are available right now. Try a custom search above!
                </AlertDescription>
              </Alert>
            )}
          </div>
        </section>
      )}

      {/* Video Introduction Section - Only show when no messages */}
      {messages.length === 0}

      {/* Footer */}
      <footer className="bg-muted py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 HomeLens. All rights reserved.</p>
        </div>
      </footer>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>;
}