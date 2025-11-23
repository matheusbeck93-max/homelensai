import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, MessageSquare, Trash2, Upload, Download, Menu, Home, User, Send, LogOut, Mic, MicOff, Calculator } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import PropertyCarousel from "@/components/PropertyCarousel";
import ProfileSelector from "@/components/ProfileSelector";
import ReactMarkdown from "react-markdown";
import { Navigation } from "@/components/Navigation";
import { EmptyState } from "@/components/EmptyState";
import InlineCalculator from "@/components/InlineCalculator";
import InlineDealAnalysis from "@/components/InlineDealAnalysis";
import { Checkbox } from "@/components/ui/checkbox";
import { UIBlockRenderer } from "@/components/ui-blocks/UIBlockRenderer";
import { PropertyResultsCarousel } from "@/components/ui-blocks/PropertyResultsCarousel";
import { UIBlock, HomeLensListing } from "@/types/ui-blocks";
const MarkdownLink = ({
  href,
  children
}: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
    {children}
  </a>;
interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string;
  properties?: Property[];
  toolType?: string;
  toolData?: any;
  uiBlock?: UIBlock;
}
interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  image_url: string;
  description?: string;
}
interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}
export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfileSelector, setShowProfileSelector] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedChatsToDelete, setSelectedChatsToDelete] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const init = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      if (session) {
        loadConversations();
        loadUserProfile();
      }

      // Check for search query parameter
      const params = new URLSearchParams(window.location.search);
      const query = params.get("q");
      if (query) {
        setInput(query);
        // Auto-send the message after a brief delay
        setTimeout(() => {
          handleSendWithQuery(query);
        }, 500);
        // Clean up URL
        window.history.replaceState({}, "", "/chat");
      }
    };
    init();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        loadConversations();
        loadUserProfile();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle initial prompt from navigation state
  useEffect(() => {
    const initialPrompt = location.state?.initialPrompt;
    const initialMessage = location.state?.initialMessage;
    
    if (initialPrompt || initialMessage) {
      const message = initialPrompt || initialMessage;
      
      // If newConversation flag is set, start fresh
      if (location.state?.newConversation) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      
      setInput(message);
      
      // Auto-send after delay
      setTimeout(() => {
        handleSendWithQuery(message);
      }, 500);
      
      // Clear the navigation state
      navigate("/chat", {
        replace: true,
        state: {}
      });
    }
  }, [location.state]);
  const loadUserProfile = async () => {
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) return;
    const {
      data
    } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setUserProfile(data);
    }
  };
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    }
  }, [currentConversationId]);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({
        behavior: "smooth"
      });
    }
  }, [messages]);
  const handleSendWithQuery = async (query: string) => {
    // This function is called when auto-sending from URL parameter
    const userMessage: Message = {
      role: "user",
      content: query
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
          messages: [userMessage],
          hasImage: false,
          userProfile: userProfile
        }
      });
      if (error) throw error;

      // Check if response contains property search trigger
      let properties: Property[] | undefined;
      let cleanedResponse = data.response;
      const propertyMatch = data.response.match(/SHOW_PROPERTIES:([^\n]+)/);
      if (propertyMatch) {
        const location = propertyMatch[1].trim();
        properties = generateMockProperties(location);
        cleanedResponse = data.response.replace(/SHOW_PROPERTIES:[^\n]+/, "").trim();
      }
      const assistantMessage: Message = {
        role: "assistant",
        content: cleanedResponse,
        properties: properties
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Save conversation if authenticated
      if (isAuthenticated) {
        let conversationId = currentConversationId;
        if (!conversationId) {
          const {
            data: {
              user
            }
          } = await supabase.auth.getUser();
          if (user) {
            const {
              data: convData
            } = await supabase.from("conversations").insert({
              user_id: user.id,
              title: query.slice(0, 50)
            }).select().single();
            if (convData) {
              conversationId = convData.id;
              setConversations(prev => [convData, ...prev]);
              setCurrentConversationId(convData.id);
            }
          }
        }
        if (conversationId) {
          await supabase.from("messages").insert([{
            conversation_id: conversationId,
            role: "user",
            content: userMessage.content
          }, {
            conversation_id: conversationId,
            role: "assistant",
            content: data.response
          }]);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const loadConversations = async () => {
    const {
      data,
      error
    } = await supabase.from("conversations").select("*").order("updated_at", {
      ascending: false
    });
    if (error) {
      console.error("Error loading conversations:", error);
      return;
    }
    setConversations(data || []);
    // Don't auto-load conversations if starting new chat
    if (data && data.length > 0 && !currentConversationId && !location.state?.newConversation) {
      setCurrentConversationId(data[0].id);
    }
  };
  const loadMessages = async (conversationId: string) => {
    const {
      data,
      error
    } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", {
      ascending: true
    });
    if (error) {
      console.error("Error loading messages:", error);
      return;
    }
    const formattedMessages: Message[] = (data || []).map(msg => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content: msg.content,
      image_url: msg.image_url || undefined
    }));
    setMessages(formattedMessages);
  };
  const createNewConversation = async () => {
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) return;
    const {
      data,
      error
    } = await supabase.from("conversations").insert({
      user_id: user.id,
      title: "New Conversation"
    }).select().single();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive"
      });
      return;
    }
    setConversations(prev => [data, ...prev]);
    setCurrentConversationId(data.id);
    setMessages([]);
  };
  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const {
      error
    } = await supabase.from("conversations").delete().eq("id", id);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
      return;
    }
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setCurrentConversationId(remaining[0].id);
      } else {
        setCurrentConversationId(null);
        setMessages([]);
      }
    }
  };
  const deleteSelectedConversations = async () => {
    if (selectedChatsToDelete.length === 0) return;
    const {
      error
    } = await supabase.from("conversations").delete().in("id", selectedChatsToDelete);
    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir conversas",
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Sucesso",
      description: `${selectedChatsToDelete.length} conversa(s) excluída(s)`
    });
    setShowDeleteDialog(false);
    setSelectedChatsToDelete([]);
    loadConversations();
    if (currentConversationId && selectedChatsToDelete.includes(currentConversationId)) {
      setCurrentConversationId(null);
      setMessages([]);
    }
  };
  const toggleChatSelection = (chatId: string) => {
    setSelectedChatsToDelete(prev => prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]);
  };
  const selectAllChats = () => {
    if (selectedChatsToDelete.length === conversations.length) {
      setSelectedChatsToDelete([]);
    } else {
      setSelectedChatsToDelete(conversations.map(c => c.id));
    }
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const exportConversation = () => {
    const text = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const blob = new Blob([text], {
      type: "text/plain"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const generateMockProperties = (location: string): Property[] => {
    const cities = location.match(/([^,]+)/);
    const city = cities ? cities[0].trim() : "Default City";
    return [{
      id: "1",
      address: "123 Main Street",
      city: city,
      state: "FL",
      price: 350000,
      beds: 3,
      baths: 2,
      sqft: 1800,
      image_url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800",
      description: "Beautiful family home with modern updates"
    }, {
      id: "2",
      address: "456 Oak Avenue",
      city: city,
      state: "FL",
      price: 425000,
      beds: 4,
      baths: 2.5,
      sqft: 2200,
      image_url: "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800",
      description: "Spacious home with pool and large backyard"
    }, {
      id: "3",
      address: "789 Pine Road",
      city: city,
      state: "FL",
      price: 285000,
      beds: 2,
      baths: 2,
      sqft: 1400,
      image_url: "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800",
      description: "Cozy starter home, move-in ready"
    }, {
      id: "4",
      address: "321 Elm Street",
      city: city,
      state: "FL",
      price: 550000,
      beds: 5,
      baths: 3,
      sqft: 3000,
      image_url: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",
      description: "Luxury home with high-end finishes"
    }, {
      id: "5",
      address: "567 Maple Drive",
      city: city,
      state: "FL",
      price: 195000,
      beds: 2,
      baths: 1,
      sqft: 1100,
      image_url: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
      description: "Investment opportunity, needs updates"
    }];
  };
  const handlePropertySelect = async (property: Property) => {
    const analysisPrompt = `I'd like a detailed analysis of this property: ${property.address}, ${property.city}, ${property.state}. Price: $${property.price.toLocaleString()}, ${property.beds} beds, ${property.baths} baths, ${property.sqft} sqft.`;
    setInput(analysisPrompt);
    // Trigger send with property data
    setTimeout(() => {
      handleSendWithProperty(property);
    }, 100);
  };
  const handleSendWithProperty = async (propertyData?: Property) => {
    if (!input.trim() && !imageFile && !propertyData || loading) return;
    if (!input.trim() && !imageFile || loading) return;

    let conversationId = currentConversationId;

    // Create conversation if it doesn't exist
    if (!conversationId) {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const {
        data,
        error
      } = await supabase.from("conversations").insert({
        user_id: user.id,
        title: "New Conversation"
      }).select().single();
      if (error) {
        toast({
          title: "Error",
          description: "Failed to create conversation",
          variant: "destructive"
        });
        return;
      }
      conversationId = data.id;
      setConversations(prev => [data, ...prev]);
      setCurrentConversationId(data.id);
    }
    const userMessage: Message = {
      role: "user",
      content: input || "Analyze this property image",
      image_url: imagePreview || undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    const tempImagePreview = imagePreview;
    setImagePreview(null);
    setImageFile(null);
    setLoading(true);
    try {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userMessage.content,
        image_url: userMessage.image_url
      });
      const {
        data,
        error
      } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [...messages, userMessage],
          hasImage: !!tempImagePreview,
          userProfile: userProfile,
          propertyData: propertyData
        }
      });
      console.log("Edge function response:", {
        data,
        error
      });
      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }
      if (!data) {
        console.error("No data received from edge function");
        throw new Error("No response from AI service");
      }
      if (!data.response) {
        console.error("Invalid response format:", data);
        throw new Error("Invalid response format from AI service");
      }

      // Check if response contains property search trigger or tool invocation
      let properties: Property[] | undefined;
      let cleanedResponse = data.response;
      let toolType: string | undefined;
      let toolData: any | undefined;

      // Check if backend returned property metadata
      if (data.hasProperties && data.properties) {
        // Check if user explicitly requested calculator in their message
        const lastUserMessage = messages[messages.length - 1]?.content || input;
        const wantsCalculator = /calculator|manual|calculate|scenarios|run numbers|use.*tool/i.test(lastUserMessage);
        if (wantsCalculator) {
          // User explicitly wants calculator - show it
          toolType = "property_analysis";
          toolData = data.properties;
        } else {
          // Just store properties for potential later use
          // Calculator won't show unless user asks for it
          properties = data.properties;
        }
      }

      // Try to parse as JSON for other tool invocations
      let uiBlock: UIBlock | undefined;
      try {
        const jsonResponse = JSON.parse(data.response);
        
        // Check for UI blocks
        if (jsonResponse.type?.startsWith("ui_block/")) {
          uiBlock = jsonResponse as UIBlock;
          cleanedResponse = jsonResponse.message || "";
        } else if (jsonResponse.type === "property_analysis") {
          // Legacy property analysis format
          toolType = "property_analysis";
          toolData = jsonResponse.properties;
          cleanedResponse = jsonResponse.analysis || "";
        } else if (jsonResponse.type === "property_comparison") {
          // Legacy comparison format
          toolType = "property_comparison";
          properties = jsonResponse.data;
          cleanedResponse = jsonResponse.message || "";
        } else if (jsonResponse.type && ["calculator", "deal_analysis"].includes(jsonResponse.type)) {
          toolType = jsonResponse.type;
          toolData = jsonResponse.data;
          cleanedResponse = jsonResponse.message || "";
        }
      } catch {
        // Not JSON, check for property search trigger
        const propertyMatch = data.response.match(/SHOW_PROPERTIES:([^\n]+)/);
        if (propertyMatch) {
          const location = propertyMatch[1].trim();
          properties = generateMockProperties(location);
          cleanedResponse = data.response.replace(/SHOW_PROPERTIES:[^\n]+/, "").trim();
        }
      }
      const assistantMessage: Message = {
        role: "assistant",
        content: cleanedResponse,
        properties: properties,
        toolType: toolType,
        toolData: toolData,
        uiBlock: uiBlock
      };
      setMessages(prev => [...prev, assistantMessage]);
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: data.response
      });
      if (messages.length === 0) {
        const title = userMessage.content.slice(0, 50) || "Property Analysis";
        await supabase.from("conversations").update({
          title,
          updated_at: new Date().toISOString()
        }).eq("id", conversationId);
        loadConversations();
      } else {
        await supabase.from("conversations").update({
          updated_at: new Date().toISOString()
        }).eq("id", conversationId);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSend = () => handleSendWithProperty();
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const startVoiceRecording = () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast({
          title: "Not Supported",
          description: "Speech recognition is not supported in your browser. Please use Chrome or Edge.",
          variant: "destructive"
        });
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
          handleSend();
        }, 100);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          toast({
            title: "Microphone Access Denied",
            description: "Please enable microphone permissions to use voice input.",
            variant: "destructive"
          });
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
  const ConversationSidebar = () => <div className="flex flex-col h-full bg-muted/30">
      <div className="p-4 border-b">
        <Button onClick={createNewConversation} className="w-full" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {conversations.map(conv => <div key={conv.id} onClick={() => setCurrentConversationId(conv.id)} className={`p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors flex items-center justify-between group ${currentConversationId === conv.id ? "bg-muted" : ""}`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="truncate text-sm">{conv.title}</span>
              </div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={e => deleteConversation(conv.id, e)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>)}
        </div>
      </ScrollArea>
      <div className="p-4 border-t space-y-2">
        <Button onClick={() => navigate("/calculators")} className="w-full" variant="outline">
          <Calculator className="mr-2 h-4 w-4" />
          Investment Calculator
        </Button>
        <Button onClick={() => {
        setShowDeleteDialog(true);
        setSelectedChatsToDelete([]);
      }} className="w-full" variant="outline" disabled={conversations.length === 0}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete chats
        </Button>
        <Button onClick={() => navigate("/settings")} className="w-full" variant="outline">
          <User className="mr-2 h-4 w-4" />
          Settings
        </Button>
        <Button onClick={handleLogout} className="w-full" variant="outline">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>;
  return <div className="flex flex-col h-screen bg-background">
      {/* Top Navigation */}
      <Navigation />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-64 border-r flex-shrink-0">
          <ConversationSidebar />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div className="border-b p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <ConversationSidebar />
                </SheetContent>
              </Sheet>
              <h1 className="text-xl font-bold">AI Assistant</h1>
            </div>
            {messages.length > 0 && <Button variant="outline" size="sm" onClick={exportConversation}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>}
          </div>

          {/* Messages - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 && showProfileSelector && <ProfileSelector onProfileChange={profile => {
            setUserProfile(profile);
            setShowProfileSelector(false);
          }} />}
            {messages.length === 0 && <div className="text-center py-12">
                <Home className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Welcome to HomeLens, let's talk!</h2>
                <p className="text-muted-foreground mb-6">
                  Your intelligent assistant for real estate, mortgages, investments, and market analysis
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">🏡 Property Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload property images or provide addresses for detailed investment analysis
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">💰 Mortgage Guidance</h3>
                    <p className="text-sm text-muted-foreground">
                      Get expert advice on loans, rates, and financing strategies
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">📊 Market Insights</h3>
                    <p className="text-sm text-muted-foreground">
                      Understand trends, opportunities, and pricing in your area
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">🎯 Investment Strategy</h3>
                    <p className="text-sm text-muted-foreground">
                      Custom strategies for flipping, renting, and portfolio building
                    </p>
                  </div>
                </div>
              </div>}
            {messages.map((message, index) => (
              <div key={index}>
                {/* Render UI Block if present (before message) */}
                {message.uiBlock && message.role === "assistant" && (
                  <div className="mb-6">
                    <UIBlockRenderer 
                      block={message.uiBlock} 
                      onPropertyAnalyze={(property) => {
                        setInput(`Analyze this property: ${property.listingUrl || property.address}`);
                        setTimeout(() => handleSend(), 100);
                      }}
                    />
                  </div>
                )}
                
                {/* Render legacy property results in unified format when no UI block is present */}
                {!message.uiBlock && message.role === "assistant" && message.properties && message.properties.length > 0 && (
                  <div className="mb-6">
                    <PropertyResultsCarousel
                      title="Properties matching your search"
                      properties={message.properties.map((p) => ({
                        id: p.id,
                        address: p.address,
                        price: p.price ?? 0,
                        beds: p.beds ?? 0,
                        baths: p.baths ?? 0,
                        sqft: p.sqft ?? 0,
                        photoUrl: (p as any).photoUrl || (p as any).image_url || (p as any).image_urls?.[0] || null,
                        listingUrl: (p as any).listingUrl || (p as any).externalLink || null,
                        status: (p as any).status ?? null,
                        source: "ai-chat",
                        city: (p as any).city ?? null,
                        state: (p as any).state ?? null,
                        zip: null,
                        lat: null,
                        lng: null,
                      } as HomeLensListing))}
                      onAnalyze={(property) => {
                        setInput(`Analyze this property: ${property.listingUrl || property.address}`);
                        setTimeout(() => handleSend(), 100);
                      }}
                    />
                  </div>
                )}
                
                <div className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() => navigate("/")}
                      className="h-10 w-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity"
                      aria-label="Go to homepage"
                    >
                      <Home className="h-6 w-6 text-primary-foreground" />
                    </button>
                  )}
                  <div className={`max-w-[80%] rounded-2xl p-4 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {message.image_url && <img src={message.image_url} alt="Uploaded" className="rounded-lg mb-2 max-w-sm" />}
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown components={{
                        a: MarkdownLink,
                        h1: ({node, ...props}) => <h1 {...props} className="text-2xl font-bold mt-6 mb-3 text-foreground flex items-center gap-2" />,
                        h2: ({node, ...props}) => <h2 {...props} className="text-xl font-semibold mt-5 mb-2 text-foreground flex items-center gap-2" />,
                        h3: ({node, ...props}) => <h3 {...props} className="text-lg font-semibold mt-4 mb-2 text-foreground" />,
                        p: ({node, ...props}) => <p {...props} className="mb-3 leading-relaxed text-foreground/90" />,
                        ul: ({node, ...props}) => <ul {...props} className="space-y-2 mb-4 ml-1" />,
                        ol: ({node, ...props}) => <ol {...props} className="space-y-2 mb-4 ml-6 list-decimal" />,
                        li: ({node, ...props}) => (
                          <li {...props} className="flex items-start gap-2 text-foreground/90">
                            <span className="text-primary mt-1 flex-shrink-0">•</span>
                            <span className="flex-1">{props.children}</span>
                          </li>
                        ),
                        strong: ({node, ...props}) => <strong {...props} className="font-semibold text-foreground" />,
                        code: ({node, className, children, ...props}) => {
                          const isInline = !className?.includes('language-');
                          return isInline ? (
                            <code {...props} className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary">
                              {children}
                            </code>
                          ) : (
                            <code {...props} className="block p-3 bg-muted rounded-lg text-sm font-mono my-2 text-foreground/80 overflow-x-auto">
                              {children}
                            </code>
                          );
                        },
                        blockquote: ({node, ...props}) => (
                          <blockquote {...props} className="border-l-4 border-primary pl-4 py-2 my-3 bg-muted/30 rounded-r-lg text-foreground/90 italic" />
                        ),
                        hr: ({node, ...props}) => <hr {...props} className="my-6 border-border" />,
                      }}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  {message.role === "user" && (
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="flex gap-4">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Home className="h-6 w-6 text-primary-foreground animate-pulse" />
                </div>
                <div className="bg-muted rounded-2xl p-4">
                  <p className="text-muted-foreground">Analyzing...</p>
                </div>
              </div>}
              <div ref={scrollRef} />
            </div>
          </div>

          {/* Input Area - Sticky at bottom */}
          <div className="border-t bg-background p-4 pb-24 md:pb-4 flex-shrink-0">
            <div className="max-w-6xl mx-auto">
            {imagePreview && <div className="mb-2 relative inline-block">
                <img src={imagePreview} alt="Preview" className="rounded-lg max-h-32" />
                <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={() => {
              setImagePreview(null);
              setImageFile(null);
            }}>
                  ×
                </Button>
              </div>}
            <div className="flex gap-2">
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                <Upload className="h-4 w-4" />
              </Button>
              <Textarea placeholder="Ask about properties, mortgages, investments, or upload a property image..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyPress} disabled={loading} className="min-h-[60px] resize-none flex-1" />
              <Button 
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={loading}
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                className={`h-[60px] w-[60px] flex-shrink-0 ${isRecording ? 'animate-pulse' : ''}`}
              >
                {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button onClick={handleSend} disabled={loading || !input.trim() && !imageFile} size="icon" className="h-[60px] w-[60px] flex-shrink-0 bg-[#3a7d9a]">
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              AI can make mistakes. Verify important information.
            </p>
            </div>
          </div>
        </div>
      </div>


      {/* Delete Conversations Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Excluir conversas</DialogTitle>
            <DialogDescription>
              Selecione as conversas que deseja excluir. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <Checkbox checked={selectedChatsToDelete.length === conversations.length && conversations.length > 0} onCheckedChange={selectAllChats} />
              <span className="text-sm font-medium">Selecionar todos ({conversations.length})</span>
            </div>
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-2">
                {conversations.map(conv => <div key={conv.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded-lg">
                    <Checkbox checked={selectedChatsToDelete.includes(conv.id)} onCheckedChange={() => toggleChatSelection(conv.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(conv.updated_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>)}
              </div>
            </ScrollArea>
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={deleteSelectedConversations} variant="destructive" className="flex-1" disabled={selectedChatsToDelete.length === 0}>
              Excluir {selectedChatsToDelete.length > 0 && `(${selectedChatsToDelete.length})`}
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
}
