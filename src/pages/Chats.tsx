import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/Navigation";
import { StickyChat } from "@/components/StickyChat";
import { v4 as uuidv4 } from "uuid";
import { Card } from "@/components/ui/card";
import { ExternalLink, Loader2, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  links?: PropertyLink[];
  createdAt: string;
}

interface PropertyLink {
  title: string;
  url: string;
  source: string;
}

export default function Chats() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('perplexity-chat', {
        body: {
          query: messageText,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        }
      });

      if (error) throw error;

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: data?.message || 'I could not process that request.',
        links: data?.links || [],
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [messages, loading, toast]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 pb-32">
        {/* Empty State */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Real Estate Assistant</h1>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Search for properties or paste a listing URL for instant analysis. I'll provide factual information only.
            </p>
            <div className="grid gap-3 w-full max-w-md">
              <Card 
                className="p-4 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSendMessage("3-bedroom homes in Phoenix under $500k with pool")}
              >
                <p className="text-sm font-medium">Search for homes</p>
                <p className="text-xs text-muted-foreground">3-bedroom homes in Phoenix under $500k with pool</p>
              </Card>
              <Card 
                className="p-4 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSendMessage("investment properties in Austin under $400k")}
              >
                <p className="text-sm font-medium">Find investment properties</p>
                <p className="text-xs text-muted-foreground">Investment properties in Austin under $400k</p>
              </Card>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a 
                            href={href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {children}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ),
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-none space-y-1 my-2">{children}</ul>,
                        li: ({ children }) => <li className="flex items-start gap-2"><span>•</span><span>{children}</span></li>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                    
                    {/* Property Links */}
                    {message.links && message.links.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {message.links.map((link, idx) => (
                          <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-md bg-background hover:bg-accent transition-colors text-sm"
                          >
                            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{link.title}</p>
                              <p className="text-xs text-muted-foreground">{link.source}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Searching...</span>
              </div>
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>
      </main>

      <StickyChat
        onSend={handleSendMessage}
        loading={loading}
        placeholder="Search for properties or paste a listing URL..."
      />
    </div>
  );
}
