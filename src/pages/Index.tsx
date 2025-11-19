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
import ReactMarkdown from "react-markdown";
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
  const [searchProperties, setSearchProperties] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
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
    try {
      // Extract location and other parameters from natural language query
      // For now, we'll parse basic patterns
      const priceMatch = query.match(/under (\$?[\d,]+k?)/i);
      const bedsMatch = query.match(/(\d+)\s*(bed|bedroom)/i);
      const cityStateMatch = query.match(/in\s+([a-z\s,]+)/i);
      
      let location = '';
      if (cityStateMatch) {
        location = cityStateMatch[1].trim();
      }
      
      if (!location) {
        toast({
          title: "Location Required",
          description: "Please specify a location in your search (e.g., 'in Austin, TX')",
          variant: "destructive"
        });
        setSearchLoading(false);
        return;
      }
      
      const params: any = { location };
      
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/[$,]/g, '');
        const price = priceStr.includes('k') 
          ? parseInt(priceStr) * 1000 
          : parseInt(priceStr);
        params.maxPrice = price;
      }
      
      if (bedsMatch) {
        params.minBeds = parseInt(bedsMatch[1]);
      }
      
      const { data, error } = await supabase.functions.invoke('search-listings', {
        body: params
      });
      
      if (error) throw error;
      
      if (data?.listings && data.listings.length > 0) {
        setSearchProperties(data.listings);
        toast({
          title: "Properties Found",
          description: `Found ${data.listings.length} properties matching your criteria`
        });
      } else {
        toast({
          title: "No Properties Found",
          description: "Try adjusting your search criteria",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "Failed to search properties. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSearchLoading(false);
    }
  };
  
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    // Check if this looks like a property search query
    if (messages.length === 0) {
      const isPropertySearch = (
        /find|search|show|looking for/i.test(input) && 
        (/home|house|property|condo|apartment|in\s+[a-z]/i.test(input))
      );
      
      if (isPropertySearch) {
        await handlePropertySearch(input);
        return;
      }
      
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
      let toolType, toolData;
      let cleanedResponse = data.response;
      try {
        const jsonResponse = JSON.parse(data.response);
        if (jsonResponse.type) {
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
        toolData
      }]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen pb-24 lg:pb-8">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">HomeLens</span>
          </div>
          <div className="flex items-center gap-4">
            <div style={{
            position: 'relative',
            zIndex: 10000
          }}>
              <InstallPrompt variant="button" />
            </div>
            <ThemeToggle />
            {user ? <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost">
                      <History className="h-4 w-4 mr-2" />
                      Activity
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Past Conversations</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {pastConversations.length === 0 ? <DropdownMenuItem disabled>No past conversations</DropdownMenuItem> : pastConversations.map(conv => <DropdownMenuItem key={conv.id} onClick={() => loadConversation(conv.id)} className="cursor-pointer">
                          <div className="flex flex-col gap-1 w-full">
                            <span className="font-medium truncate">{conv.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(conv.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" onClick={() => navigate('/investor')}>
                  HomeLens Investor
                </Button>
                <Button variant="ghost" onClick={() => navigate('/calculators')}>
                  Calculator
                </Button>
                <Button variant="ghost" onClick={() => navigate('/profile')}>
                  Profile
                </Button>
                <Button variant="outline" onClick={handleLogout} size="sm">
                  Sign Out
                </Button>
              </> : <>
                <Button variant="ghost" onClick={() => navigate('/investor')}>
                  HomeLens Investor
                </Button>
                <Button variant="ghost" onClick={() => navigate('/calculators')}>
                  Calculator
                </Button>
                <Button onClick={() => navigate('/auth')} size="sm">
                  Sign In
                </Button>
              </>}
          </div>
        </div>
      </nav>

      {/* Hero Section with Search */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-muted pb-24 md:pb-0">
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {messages.length === 0 ? <div className="text-center space-y-8">
                <h1 className="text-5xl font-bold text-foreground mb-12">
                  Find your new home
                </h1>
                
                {/* Property Search Results */}
                {searchProperties.length > 0 && (
                  <div className="mb-8">
                    <PropertyCarousel 
                      properties={searchProperties}
                      onSelectProperty={(property) => {
                        toast({
                          title: "Property Selected",
                          description: `Analyzing ${property.address}`
                        });
                      }}
                    />
                  </div>
                )}
                
                <div className="bg-card border rounded-2xl p-6 shadow-lg">
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
                    {messages.map((msg, i) => <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
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
                      </div>)}
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

      {/* Video Introduction Section - Only show when no messages */}
      {messages.length === 0}

      {/* Footer */}
      <footer className="bg-muted py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 HomeLens. All rights reserved.</p>
        </div>
      </footer>
    </div>;
}