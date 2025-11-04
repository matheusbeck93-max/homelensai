import { Button } from "@/components/ui/button";
import { Home, Bot, Send, Plus, History } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import InlineCalculator from "@/components/InlineCalculator";
import InlineDealAnalysis from "@/components/InlineDealAnalysis";
import ReactMarkdown from "react-markdown";
import heroBackground from "@/assets/american-house-hero.jpg";
import videoThumbnail from "@/assets/homelens-intro-thumbnail.jpg";
import { Play } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MarkdownLink = ({ href, children }: any) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
    {children}
  </a>
);

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pastConversations, setPastConversations] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadPastConversations(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadPastConversations(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadPastConversations = async (userId: string) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (!error && data) {
      setPastConversations(data);
    }
  };

  const loadConversation = async (convId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      setMessages(data.map(msg => ({
        role: msg.role,
        content: msg.content,
      })));
      setConversationId(convId);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleNewConversation = async () => {
    // Save current conversation if there are messages and user is signed in
    if (messages.length > 0 && user) {
      try {
        let currentConvId = conversationId;
        
        // Create conversation if it doesn't exist
        if (!currentConvId) {
          const { data: convData, error: convError } = await supabase
            .from('conversations')
            .insert({
              user_id: user.id,
              title: messages[0]?.content?.substring(0, 50) || 'New Conversation',
            })
            .select()
            .single();

          if (!convError && convData) {
            currentConvId = convData.id;
          }
        }

        // Save messages
        if (currentConvId) {
          const messagesToSave = messages.map(msg => ({
            conversation_id: currentConvId,
            role: msg.role,
            content: msg.content,
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

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [...messages, userMessage] },
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
      } catch {}

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

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">HomeLens</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {user ? (
              <>
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
                    {pastConversations.length === 0 ? (
                      <DropdownMenuItem disabled>No past conversations</DropdownMenuItem>
                    ) : (
                      pastConversations.map((conv) => (
                        <DropdownMenuItem 
                          key={conv.id}
                          onClick={() => loadConversation(conv.id)}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col gap-1 w-full">
                            <span className="font-medium truncate">{conv.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(conv.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" onClick={() => navigate('/chat')}>
                  Chat
                </Button>
                <Button variant="ghost" onClick={() => navigate('/profile')}>
                  Profile
                </Button>
                <Button variant="outline" onClick={handleLogout}>
                  Sign Out
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate('/auth')}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section with Search */}
      <section 
        className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-muted"
      >
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {messages.length === 0 ? (
              <div className="text-center space-y-8">
                <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-12">
                  Find your new home
                </h1>
                <div className="bg-card border rounded-2xl p-6 shadow-lg">
                  <Textarea
                    placeholder="Ask about properties dropping a link from any real estate - calculate mortgage, analyze investment, compare and get unlimited insights..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                    className="min-h-[100px] mb-4"
                  />
                  <Button onClick={handleSend} disabled={loading} className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    Ask HomeLens
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-card border rounded-2xl p-6 h-[85vh] flex flex-col shadow-lg">
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
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <Bot className="h-5 w-5 text-primary-foreground" />
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <ReactMarkdown components={{ a: MarkdownLink }}>{msg.content}</ReactMarkdown>
                          {msg.toolType === 'calculator' && <InlineCalculator />}
                          {msg.toolType === 'deal_analysis' && <InlineDealAnalysis initialData={msg.toolData} />}
                        </div>
                      </div>
                    ))}
                    {loading && <div className="text-muted-foreground">Thinking...</div>}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>
                <div className="mt-4 flex gap-2">
                  <Textarea
                    placeholder="Follow up question..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={loading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Video Introduction Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Introducing HomeLens
            </h2>
            <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
              Discover how HomeLens empowers investors, families, and first-time buyers to achieve their real estate goals with AI-powered insights and tools.
            </p>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl group cursor-pointer bg-card border">
              <img 
                src={videoThumbnail} 
                alt="Introducing HomeLens - AI-powered real estate platform"
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all flex items-center justify-center">
                <div className="bg-primary rounded-full p-6 group-hover:scale-110 transition-transform shadow-lg">
                  <Play className="h-12 w-12 text-primary-foreground fill-current" />
                </div>
              </div>
            </div>
            <div className="mt-8 grid md:grid-cols-3 gap-6 text-center">
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2">For Investors</h3>
                <p className="text-sm text-muted-foreground">Advanced deal analysis, ROI calculators, and market insights</p>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2">For Families</h3>
                <p className="text-sm text-muted-foreground">Find the perfect home with AI-powered recommendations</p>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2">For First-Timers</h3>
                <p className="text-sm text-muted-foreground">Step-by-step guidance through your home buying journey</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 HomeLens. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
