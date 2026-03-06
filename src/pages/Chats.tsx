import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/Navigation";
import { StickyChat } from "@/components/StickyChat";
import { SavedChatsSidebar } from "@/components/chat/SavedChatsSidebar";
import { ChatComparisonPanel, AnalyzedProperty } from "@/components/chat/ChatComparisonPanel";
import { useSavedChats, ChatMessage } from "@/hooks/useSavedChats";
import { v4 as uuidv4 } from "uuid";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, MessageSquare, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { UIBlock } from "@/types/ui-blocks";
import { UIBlockRenderer } from "@/components/ui-blocks/UIBlockRenderer";

interface PropertyLink {
  title: string;
  url: string;
  source: string;
}

// Parse analyzed property data from assistant message
function parseAnalyzedProperty(content: string, url: string): AnalyzedProperty | null {
  const extractField = (pattern: RegExp): string | undefined => {
    const match = content.match(pattern);
    return match ? match[1].trim() : undefined;
  };

  // Only parse if it looks like an analysis response
  if (!content.includes("Property Summary") && !content.includes("Price:")) {
    return null;
  }

  const property: AnalyzedProperty = {
    id: uuidv4(),
    url,
    rawAnalysis: content,
    price: extractField(/Price:\s*([^\n]+)/i),
    address: extractField(/Address:\s*([^\n]+)/i),
    bedrooms: extractField(/Bedrooms?:\s*([^\n]+)/i),
    bathrooms: extractField(/Bathrooms?:\s*([^\n]+)/i),
    size: extractField(/Size:\s*([^\n]+)/i),
    hoa: extractField(/HOA:\s*([^\n]+)/i),
    taxes: extractField(/Taxes?:\s*([^\n]+)/i),
    yearBuilt: extractField(/Year\s*[Bb]uilt:\s*([^\n]+)/i),
    propertyType: extractField(/Property\s*[Tt]ype:\s*([^\n]+)/i)
  };

  // Extract key features
  const featuresMatch = content.match(/Key\s*[Ff]eatures?:([^•\n]*(?:•[^\n]+\n?)*)/i);
  if (featuresMatch) {
    property.keyFeatures = featuresMatch[1].
    split(/[•\-\n]/).
    map((f) => f.trim()).
    filter((f) => f.length > 0 && f.length < 50);
  }

  return property;
}

// Extract URL from user message
function extractUrl(text: string): string | null {
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  return urlMatch ? urlMatch[0] : null;
}

// Detect if a message is requesting a workflow/budget/plan (Excel generation)
function isWorkflowRequest(text: string): boolean {
  const patterns = /(budget|orçamento|plan|plano|breakdown|estimate|estimativa|cost breakdown|renovation plan|financing plan|amortization|roi analysis|spreadsheet|planilha|create a .*(plan|budget|estimate)|give me a breakdown|what would it cost|calculate the roi|build a .*(plan|budget)|can i afford|afford a house|afford a home|buying power|quanto custa|posso comprar|affordability|how much house|how much home|what can i buy|monthly payment for|mortgage for|investment analysis|cash flow analysis|rental income for)/i;
  return patterns.test(text);
}

export default function Chats() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialMessageProcessed = useRef(false);

  // Saved chats hook
  const {
    user,
    conversations,
    currentConversationId,
    messages,
    setMessages,
    loading: loadingHistory,
    loadMessages,
    createConversation,
    saveMessage,
    deleteConversation,
    renameConversation,
    startNewChat,
    clearAllConversations
  } = useSavedChats();

  // Local state
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [comparisonProperties, setComparisonProperties] = useState<AnalyzedProperty[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [lastAnalyzedUrl, setLastAnalyzedUrl] = useState<string | null>(null);
  const [userPrimaryGoal, setUserPrimaryGoal] = useState<string | null>(null);

  // Load user's primary goal for contextual AI
  useEffect(() => {
    const loadGoal = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("primary_goal")
        .eq("id", user.id)
        .single();
      if (data?.primary_goal) {
        setUserPrimaryGoal(data.primary_goal);
      }
    };
    loadGoal();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || loading) return;

    // Detect insight origin tags
    let insightOrigin: string | null = null;
    let cleanedMessage = messageText;
    
    if (messageText.startsWith('[CALCULATORS_AI_INSIGHT]')) {
      insightOrigin = 'calculators';
      cleanedMessage = messageText.replace('[CALCULATORS_AI_INSIGHT]\n\n', '');
    } else if (messageText.startsWith('[INVESTOR_AI_INSIGHT]')) {
      insightOrigin = 'investor';
      cleanedMessage = messageText.replace('[INVESTOR_AI_INSIGHT]\n\n', '');
    }

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: cleanedMessage,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    // Track URL for comparison feature
    const extractedUrl = extractUrl(cleanedMessage);
    if (extractedUrl) {
      setLastAnalyzedUrl(extractedUrl);
    }

    // Auto-save: Create conversation if needed (for logged in users)
    let conversationId = currentConversationId;
    if (user && !conversationId) {
      conversationId = await createConversation(cleanedMessage);
      if (conversationId) {
        toast({
          title: "Chat saved",
          description: "Your conversation is being saved automatically"
        });
      }
    }

    // Auto-save: Save user message immediately
    if (user && conversationId) {
      saveMessage(userMessage, conversationId);
    }

    try {
      const { data, error } = await supabase.functions.invoke('perplexity-chat', {
        body: {
          query: cleanedMessage,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          insightOrigin,
          userGoal: userPrimaryGoal
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

      setMessages((prev) => [...prev, assistantMessage]);

      // Auto-save: Save assistant message immediately
      if (user && conversationId) {
        saveMessage(assistantMessage, conversationId);
      }

      // Check if this was an analysis that can be compared
      if (extractedUrl && data?.message) {
        const parsed = parseAnalyzedProperty(data.message, extractedUrl);
        if (parsed) {
          // Store for potential comparison
          assistantMessage.metadata = { analyzedProperty: parsed };
        }
      }

      // Secondary call to ai-chat for Excel workflow generation
      const perplexityResponse = data?.message || '';
      if (isWorkflowRequest(cleanedMessage)) {
        try {
          const { data: excelData, error: excelError } = await supabase.functions.invoke('ai-chat', {
            body: {
              messages: [
                { role: 'user', content: cleanedMessage },
                { role: 'assistant', content: perplexityResponse },
                { role: 'user', content: `Based on the analysis above, generate a detailed Excel spreadsheet that includes ALL the numbers, values, costs, and data points mentioned. Every dollar amount, percentage, and metric should appear in the spreadsheet cells with proper values filled in. Do not leave any cells empty if a value was mentioned in the analysis.` }
              ],
              conversationMode: true
            }
          });

          const excelBlock = excelData?.uiBlock || excelData?.response?.uiBlock;
          if (!excelError && excelBlock && excelBlock.type === 'workflow_excel') {
            const excelMessage: ChatMessage = {
              id: uuidv4(),
              role: 'assistant',
              content: '',
              createdAt: new Date().toISOString(),
              metadata: { uiBlock: excelBlock }
            };
            setMessages((prev) => [...prev, excelMessage]);

            if (user && conversationId) {
              saveMessage(excelMessage, conversationId);
            }
          }
        } catch (excelErr) {
          console.warn('Excel workflow generation failed (non-blocking):', excelErr);
        }
      }
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
  }, [messages, loading, toast, user, currentConversationId, createConversation, saveMessage, setMessages, userPrimaryGoal]);

  // Handle initial message from homepage/calculators/investor navigation
  useEffect(() => {
    const state = location.state as {initialMessage?: string;} | null;
    if (state?.initialMessage && !initialMessageProcessed.current && !loadingHistory) {
      initialMessageProcessed.current = true;
      window.history.replaceState({}, document.title);
      handleSendMessage(state.initialMessage);
    }
  }, [location.state, loadingHistory, handleSendMessage]);

  const addToComparison = useCallback((content: string, url: string) => {
    const property = parseAnalyzedProperty(content, url);
    if (property) {
      if (comparisonProperties.some((p) => p.url === url)) {
        toast({
          title: "Already added",
          description: "This property is already in comparison"
        });
        return;
      }
      setComparisonProperties((prev) => [...prev, property]);
      setShowComparison(true);
      toast({
        title: "Added to comparison",
        description: `${comparisonProperties.length + 1} properties selected`
      });
    }
  }, [comparisonProperties, toast]);

  const removeFromComparison = useCallback((id: string) => {
    setComparisonProperties((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearComparison = useCallback(() => {
    setComparisonProperties([]);
    setShowComparison(false);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      {/* Saved Chats Sidebar */}
      <SavedChatsSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        user={user}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={loadMessages}
        onNewChat={startNewChat}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onClearAllConversations={clearAllConversations}
        onLogin={() => navigate('/auth')} />


      <main className={cn(
        "flex-1 pb-32 transition-all duration-200",
        "md:ml-64"
      )}>
        {/* Comparison Panel */}
        {showComparison &&
        <div className="sticky top-16 z-20 mx-4 mt-4">
            <ChatComparisonPanel
            properties={comparisonProperties}
            onRemove={removeFromComparison}
            onClear={clearComparison}
            onClose={() => setShowComparison(false)}
            onAddProperty={(property) => {
              if (!comparisonProperties.some((p) => p.url === property.url)) {
                setComparisonProperties((prev) => [...prev, property]);
              }
            }} />

          </div>
        }


        {/* Empty State */}
        {messages.length === 0 && !loading && !loadingHistory &&
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Real Estate Assistant</h1>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Search for properties or paste a listing URL for instant analysis. I'll provide factual information only.
            </p>
            <div className="grid gap-3 w-full max-w-md">
              <Card className="p-4">
                <p className="text-sm font-medium">Search for homes</p>
                <p className="text-xs text-muted-foreground">3-bedroom homes in Phoenix under $500k with pool</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm font-medium">Find investment properties</p>
                <p className="text-xs text-muted-foreground">Investment properties in Austin under $400k</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm font-medium">Analyze a listing</p>
                <p className="text-xs text-muted-foreground">Paste a Zillow, Redfin, or Realtor.com URL for instant analysis</p>
              </Card>
              



              <Card className="p-4">
                <p className="text-sm font-medium">Calculate mortgage</p>
                <p className="text-xs text-muted-foreground">Monthly payment for a $350k home with 20% down at 6.5%</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm font-medium">Estimate rental income</p>
                <p className="text-xs text-muted-foreground">Expected rent for a 2-bed condo in Denver</p>
              </Card>
            </div>
          </div>
        }

        {/* Loading History */}
        {loadingHistory &&
        <div className="flex justify-center items-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }

        {/* Messages */}
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.map((message) => {
            const messageUrl = message.role === 'user' ? extractUrl(message.content) : null;
            const isAnalysis = message.role === 'assistant' && (
            message.content.includes("Property Summary") || message.content.includes("Price:"));
            const analysisUrl = isAnalysis ? lastAnalyzedUrl : null;

            return (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  message.role === 'user' ?
                  'bg-primary text-primary-foreground' :
                  'bg-muted'}`
                  }>

                  {message.role === 'assistant' ?
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                      components={{
                        a: ({ href, children }) =>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1">

                              {children}
                              <ExternalLink className="h-3 w-3" />
                            </a>,

                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-none space-y-1 my-2">{children}</ul>,
                        li: ({ children }) => <li className="flex items-start gap-2"><span>•</span><span>{children}</span></li>
                      }}>

                        {message.content}
                      </ReactMarkdown>
                      
                      {/* Add to Comparison Button */}
                      {isAnalysis && analysisUrl &&
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={() => addToComparison(message.content, analysisUrl)}>

                          <Plus className="h-3 w-3" />
                          Add to Comparison
                        </Button>
                    }
                      
                      {/* Property Links - Card Style Only */}
                      {message.links && message.links.length > 0 &&
                    <div className="mt-4 grid gap-3">
                          {message.links.map((link, idx) =>
                      <Card
                        key={idx}
                        className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}>

                              <div className="flex items-center gap-3 p-4">
                                <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <ExternalLink className="h-5 w-5 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-sm">{link.title}</p>
                                  <p className="text-xs text-muted-foreground">{link.source}</p>
                                </div>
                                <Badge variant="secondary" className="flex-shrink-0">
                                  View
                                </Badge>
                              </div>
                            </Card>
                      )}
                        </div>
                    }
                    </div> :

                  message.content ? <p className="text-sm whitespace-pre-wrap">{message.content}</p> : null
                  }

                  {/* UI Block (Excel Workflow, etc.) */}
                  {message.metadata?.uiBlock && (
                    <div className="mt-3">
                      <UIBlockRenderer block={message.metadata.uiBlock as UIBlock} />
                    </div>
                  )}
                </div>
              </div>);

          })}
          
          {loading &&
          <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Searching...</span>
              </div>
            </div>
          }
          
          <div ref={scrollRef} />
        </div>
      </main>

      <div className={cn("transition-all duration-200", "md:ml-64")}>
        <StickyChat
          onSend={handleSendMessage}
          loading={loading}
          placeholder="Search for properties or paste a listing URL..."
          showVoice={true} />

      </div>
    </div>);

}