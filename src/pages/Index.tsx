import { Button } from "@/components/ui/button";
import { Home, Bot, Send } from "lucide-react";
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

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
          <div className="max-w-2xl mx-auto">
            {messages.length === 0 ? (
              <div className="text-center space-y-8">
                <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-12">
                  Find your new home
                </h1>
                <div className="bg-card border rounded-2xl p-6 shadow-lg">
                  <Textarea
                    placeholder="Search properties, ask about mortgages, or request calculators..."
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
              <div className="bg-card border rounded-2xl p-6 h-[60vh] flex flex-col shadow-lg">
                <ScrollArea className="flex-1 min-h-0 pr-4">
                  <div className="space-y-4">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <Bot className="h-5 w-5 text-primary-foreground" />
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
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

      {/* Footer */}
      <footer className="bg-muted py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 HomeLens. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
