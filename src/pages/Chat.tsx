import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, MessageSquare, Trash2, Upload, Download, Menu, Bot, User, Send, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import PropertyCarousel from "@/components/PropertyCarousel";
import ProfileSelector from "@/components/ProfileSelector";
import ReactMarkdown from "react-markdown";
import { Navigation } from "@/components/Navigation";
import { EmptyState } from "@/components/EmptyState";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string;
  properties?: Property[];
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
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasShownAuthDialog, setHasShownAuthDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      
      if (session) {
        loadConversations();
        loadUserProfile();
      }
      
      // Check for search query parameter
      const params = new URLSearchParams(window.location.search);
      const query = params.get('q');
      if (query) {
        setInput(query);
        // Auto-send the message after a brief delay
        setTimeout(() => {
          handleSendWithQuery(query);
        }, 500);
        // Clean up URL
        window.history.replaceState({}, '', '/chat');
      }
    };
    init();
  }, []);

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

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
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendWithQuery = async (query: string) => {
    // This function is called when auto-sending from URL parameter
    const userMessage: Message = { 
      role: "user", 
      content: query
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { 
          messages: [userMessage],
          hasImage: false,
          userProfile: userProfile
        },
      });

      if (error) throw error;

      // Check if response contains property search trigger
      let properties: Property[] | undefined;
      let cleanedResponse = data.response;
      
      const propertyMatch = data.response.match(/SHOW_PROPERTIES:([^\n]+)/);
      if (propertyMatch) {
        const location = propertyMatch[1].trim();
        properties = generateMockProperties(location);
        cleanedResponse = data.response.replace(/SHOW_PROPERTIES:[^\n]+/, '').trim();
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: cleanedResponse,
        properties: properties,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);

      // Show auth dialog after first response if not authenticated and hasn't been shown yet
      if (!isAuthenticated && !hasShownAuthDialog) {
        setTimeout(() => {
          setShowAuthDialog(true);
          setHasShownAuthDialog(true);
        }, 1000);
      }

      // Save conversation if authenticated
      if (isAuthenticated) {
        let conversationId = currentConversationId;
        
        if (!conversationId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: convData } = await supabase
              .from("conversations")
              .insert({ user_id: user.id, title: query.slice(0, 50) })
              .select()
              .single();
            
            if (convData) {
              conversationId = convData.id;
              setConversations((prev) => [convData, ...prev]);
              setCurrentConversationId(convData.id);
            }
          }
        }

        if (conversationId) {
          await supabase.from("messages").insert([
            {
              conversation_id: conversationId,
              role: "user",
              content: userMessage.content,
            },
            {
              conversation_id: conversationId,
              role: "assistant",
              content: data.response,
            }
          ]);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading conversations:", error);
      return;
    }

    setConversations(data || []);
    if (data && data.length > 0 && !currentConversationId) {
      setCurrentConversationId(data[0].id);
    }
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    const formattedMessages: Message[] = (data || []).map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content: msg.content,
      image_url: msg.image_url || undefined,
    }));

    setMessages(formattedMessages);
  };

  const createNewConversation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New Conversation" })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
      return;
    }

    setConversations((prev) => [data, ...prev]);
    setCurrentConversationId(data.id);
    setMessages([]);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
      return;
    }

    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setCurrentConversationId(remaining[0].id);
      } else {
        setCurrentConversationId(null);
        setMessages([]);
      }
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
    const text = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateMockProperties = (location: string): Property[] => {
    const cities = location.match(/([^,]+)/);
    const city = cities ? cities[0].trim() : "Default City";
    
    return [
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      }
    ];
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
    if ((!input.trim() && !imageFile && !propertyData) || loading) return;
    if ((!input.trim() && !imageFile) || loading) return;

    let conversationId = currentConversationId;

    // Create conversation if it doesn't exist
    if (!conversationId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title: "New Conversation" })
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create conversation",
          variant: "destructive",
        });
        return;
      }

      conversationId = data.id;
      setConversations((prev) => [data, ...prev]);
      setCurrentConversationId(data.id);
    }

    const userMessage: Message = { 
      role: "user", 
      content: input || "Analyze this property image",
      image_url: imagePreview || undefined
    };
    
    setMessages((prev) => [...prev, userMessage]);
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
        image_url: userMessage.image_url,
      });

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { 
          messages: [...messages, userMessage],
          hasImage: !!tempImagePreview,
          userProfile: userProfile,
          propertyData: propertyData
        },
      });

      if (error) throw error;

      // Check if response contains property search trigger
      let properties: Property[] | undefined;
      let cleanedResponse = data.response;
      
      const propertyMatch = data.response.match(/SHOW_PROPERTIES:([^\n]+)/);
      if (propertyMatch) {
        const location = propertyMatch[1].trim();
        properties = generateMockProperties(location);
        cleanedResponse = data.response.replace(/SHOW_PROPERTIES:[^\n]+/, '').trim();
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: cleanedResponse,
        properties: properties,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: data.response,
      });

      if (messages.length === 0) {
        const title = userMessage.content.slice(0, 50) || "Property Analysis";
        await supabase
          .from("conversations")
          .update({ title, updated_at: new Date().toISOString() })
          .eq("id", conversationId);
        
        loadConversations();
      } else {
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
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

  const ConversationSidebar = () => (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="p-4 border-b">
        <Button onClick={createNewConversation} className="w-full" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setCurrentConversationId(conv.id)}
              className={`p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors flex items-center justify-between group ${
                currentConversationId === conv.id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="truncate text-sm">{conv.title}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => deleteConversation(conv.id, e)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t space-y-2">
        <Button onClick={() => navigate("/settings")} className="w-full" variant="outline">
          <User className="mr-2 h-4 w-4" />
          Settings
        </Button>
        <Button onClick={handleLogout} className="w-full" variant="outline">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 border-r">
        <ConversationSidebar />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between">
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
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Real Estate AI Assistant</h1>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportConversation}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && showProfileSelector && (
              <ProfileSelector onProfileChange={(profile) => {
                setUserProfile(profile);
                setShowProfileSelector(false);
              }} />
            )}
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Welcome to Real Estate AI</h2>
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
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-4 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-6 w-6 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.image_url && (
                    <img src={message.image_url} alt="Uploaded" className="rounded-lg mb-2 max-w-sm" />
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            className="text-blue-500 hover:text-blue-700 underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        ),
                        p: ({ node, ...props }) => <p {...props} className="mb-2" />,
                        ul: ({ node, ...props }) => <ul {...props} className="list-disc ml-4 mb-2" />,
                        ol: ({ node, ...props }) => <ol {...props} className="list-decimal ml-4 mb-2" />,
                        strong: ({ node, ...props }) => <strong {...props} className="font-bold" />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  {message.properties && message.properties.length > 0 && (
                    <div className="mt-4">
                      <PropertyCarousel 
                        properties={message.properties}
                        onSelectProperty={handlePropertySelect}
                      />
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="h-6 w-6 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="h-6 w-6 text-primary-foreground animate-pulse" />
                </div>
                <div className="bg-muted rounded-2xl p-4">
                  <p className="text-muted-foreground">Analyzing...</p>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="max-w-4xl mx-auto">
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img src={imagePreview} alt="Preview" className="rounded-lg max-h-32" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={() => {
                    setImagePreview(null);
                    setImageFile(null);
                  }}
                >
                  ×
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Textarea
                placeholder="Ask about properties, mortgages, investments, or upload a property image..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={loading}
                className="min-h-[60px] resize-none"
              />
              <Button onClick={handleSend} disabled={loading || (!input.trim() && !imageFile)} size="icon" className="h-[60px]">
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in to continue</DialogTitle>
            <DialogDescription>
              Create an account or sign in to save your conversations and access all features.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button onClick={() => navigate('/auth')} className="w-full">
              Sign In / Sign Up
            </Button>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)} className="w-full">
              Continue as Guest
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
