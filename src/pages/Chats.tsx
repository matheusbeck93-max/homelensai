import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/Navigation";
import { StickyChat, ChatAttachment } from "@/components/StickyChat";
import { SavedChatsSidebar } from "@/components/chat/SavedChatsSidebar";
import { ChatComparisonPanel, AnalyzedProperty } from "@/components/chat/ChatComparisonPanel";
import { useSavedChats, ChatMessage } from "@/hooks/useSavedChats";
import { v4 as uuidv4 } from "uuid";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, MessageSquare, Plus, Target, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import { TextToSpeechButton } from "@/components/chat/TextToSpeechButton";
import { SaveAnalysisButton } from "@/components/chat/SaveAnalysisButton";
import { MessageActions } from "@/components/chat/MessageActions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { chatMarkdownComponents } from "@/components/chat/markdownComponents";
import { cn } from "@/lib/utils";
import { UIBlock } from "@/types/ui-blocks";
import { UIBlockRenderer } from "@/components/ui-blocks/UIBlockRenderer";

// ── Match Score parser ──
function parseMatchScore(content: string): { score: number | null; cleanContent: string } {
  const match = content.match(/^MATCH_SCORE:\s*([\d.]+)\/10\s*\n?/i);
  if (match) {
    const score = parseFloat(match[1]);
    const cleanContent = content.slice(match[0].length).trim();
    return { score: Number.isFinite(score) ? score : null, cleanContent };
  }
  return { score: null, cleanContent: content };
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'hsl(var(--chart-2))';  // green from design system
  if (score >= 5) return 'hsl(var(--chart-4))';  // yellow
  return 'hsl(var(--destructive))';  // red
}

function getScoreLabel(score: number): string {
  if (score >= 8) return 'Excellent Match';
  if (score >= 6) return 'Good Match';
  if (score >= 4) return 'Fair Match';
  return 'Poor Match';
}

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

// User explicitly asks for an Excel/spreadsheet/download
function isExplicitExcelRequest(text: string): boolean {
  const patterns = /(excel|spreadsheet|planilha|xlsx|workbook|export(?:\s+to|\s+as)?\s+(?:excel|spreadsheet)|download(?:able)?(?:\s+(?:file|excel|spreadsheet))?|send (?:me )?the (?:spreadsheet|excel|file)|generate (?:an? )?(?:excel|xlsx|spreadsheet)|baixa(?:r)? (?:a )?planilha|crie? uma planilha|me envie a planilha|envia(?:r)? (?:a )?planilha)/i;
  return patterns.test(text);
}

// Calculation/scenario topics where the agent should OFFER a spreadsheet (not auto-send)
function shouldOfferExcel(text: string): boolean {
  const patterns = /(can i afford|afford a (house|home|property|condo)|affordability|how much (house|home|can i|do i need)|what can i (buy|afford)|buying power|monthly payment|mortgage for|amortization|financing plan|investment analysis|cash flow|cap rate|roi\b|rental income|renovation|remodel|rehab|flip analysis|down payment|closing cost|cost breakdown|budget|quanto custa|posso comprar)/i;
  return patterns.test(text);
}

// User affirmatively accepts a previous offer
function isAffirmativeReply(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length > 60) return false;
  return /^(yes|yeah|yep|yup|sure|please|please do|ok|okay|go ahead|do it|send it|send me|generate it|generate|export it|let'?s do it|sounds good|pode|sim|envia|envie|manda|pode mandar|pode enviar|claro)\b[\s.!]*$/i.test(t);
}

const EXCEL_OFFER_LINE = "Want me to put this into a downloadable Excel spreadsheet?";

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
  const [pendingInput, setPendingInput] = useState<string>("");
  // Edit a previously-sent user message:
  // - Remove that user message and the assistant reply that immediately followed it (if any)
  // - Populate the input with the original text so the user can adjust and re-submit
  // - On re-submit, the normal send flow re-runs the query, replacing the prior assistant response
  const handleEditUserMessage = useCallback((messageId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx === -1) return prev;
      const target = prev[idx];
      // Drop the user message and any assistant messages immediately after it (until next user msg)
      let dropUntil = idx + 1;
      while (dropUntil < prev.length && prev[dropUntil].role === "assistant") {
        dropUntil += 1;
      }
      const next = [...prev.slice(0, idx), ...prev.slice(dropUntil)];
      // Populate the input outside this updater
      queueMicrotask(() => setPendingInput(target.content));
      return next;
    });
  }, [setMessages]);


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

  const handleSendMessage = useCallback(async (messageText: string, attachments?: ChatAttachment[]) => {
    if ((!messageText.trim() && (!attachments || attachments.length === 0)) || loading) return;

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
      attachments: attachments?.map(a => ({ name: a.name, mimeType: a.mimeType })),
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
      const requestBody: any = {
        query: cleanedMessage,
        conversationHistory: messages.map((m) => ({
          role: m.role,
          content: m.content
        })),
        insightOrigin,
        userGoal: userPrimaryGoal
      };

      // If there are attachments, use ai-chat edge function directly for multimodal support
      if (attachments && attachments.length > 0) {
        const fileNames = attachments.map(a => a.name).join(', ');
        const { data, error } = await supabase.functions.invoke('ai-chat', {
          body: {
            messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: cleanedMessage || `Analyze these documents: ${fileNames}` }],
            conversationMode: true,
            attachments: attachments.map(a => ({
              name: a.name,
              mimeType: a.mimeType,
              data: a.data,
            })),
          }
        });

        if (error) throw error;

        let rawResponse = data?.response ?? data;
        let jsonData: any = null;

        if (rawResponse && typeof rawResponse === 'object' && rawResponse.message) {
          jsonData = rawResponse;
        } else if (typeof rawResponse === 'string') {
          try { jsonData = JSON.parse(rawResponse); } catch { jsonData = { message: rawResponse }; }
        } else {
          jsonData = { message: String(rawResponse || 'No response received') };
        }

        const assistantMessage: ChatMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: jsonData.message || 'I could not process those documents.',
          createdAt: new Date().toISOString()
        };

        setMessages((prev) => [...prev, assistantMessage]);
        if (user && conversationId) saveMessage(assistantMessage, conversationId);
        return;
      }

      const { data, error } = await supabase.functions.invoke('perplexity-chat', {
        body: requestBody
      });

      if (error) throw error;

      const rawMessage = data?.message || 'I could not process that request.';
      const { score: matchScore, cleanContent } = parseMatchScore(rawMessage);

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: cleanContent,
        links: data?.links || [],
        createdAt: new Date().toISOString(),
        metadata: matchScore !== null ? { matchScore } : undefined
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Auto-save: Save assistant message immediately
      if (user && conversationId) {
        saveMessage(assistantMessage, conversationId);
      }

      // Check if this was an analysis that can be compared
      if (extractedUrl && cleanContent) {
        const parsed = parseAnalyzedProperty(cleanContent, extractedUrl);
        if (parsed) {
          // Store for potential comparison
          assistantMessage.metadata = { ...assistantMessage.metadata, analyzedProperty: parsed };
        }
      }

      // Excel generation: ONLY when user explicitly requests OR accepts a previous offer.
      const perplexityResponse = data?.message || '';

      // Find the most recent assistant message BEFORE this turn (state still pre-update)
      const lastAssistantBefore = [...messages].reverse().find(m => m.role === 'assistant');
      const previousOfferedExcel = !!lastAssistantBefore?.content && /downloadable Excel spreadsheet|spreadsheet\?|planilha\?/i.test(lastAssistantBefore.content);

      const userExplicitlyAsked = isExplicitExcelRequest(cleanedMessage);
      const userAcceptedOffer = previousOfferedExcel && isAffirmativeReply(cleanedMessage);
      const allowExcel = userExplicitlyAsked || userAcceptedOffer;

      // For calculation/scenario topics, append a single offer line if the agent didn't already offer.
      if (!allowExcel && shouldOfferExcel(cleanedMessage) && !/spreadsheet\?|planilha\?/i.test(cleanContent)) {
        const withOffer = `${cleanContent.trimEnd()}\n\n${EXCEL_OFFER_LINE}`;
        assistantMessage.content = withOffer;
        setMessages((prev) => prev.map(m => m.id === assistantMessage.id ? { ...m, content: withOffer } : m));
        if (user && conversationId) {
          // Re-save with offer appended (best-effort; non-blocking)
          saveMessage({ ...assistantMessage, content: withOffer }, conversationId);
        }
      }

      if (allowExcel) {
        try {
          const { data: excelData, error: excelError } = await supabase.functions.invoke('ai-chat', {
            body: {
              messages: [
                { role: 'user', content: lastAssistantBefore?.content ? `Prior context to use for the workbook:\n\n${lastAssistantBefore.content}` : cleanedMessage },
                { role: 'assistant', content: perplexityResponse },
                { role: 'user', content: `The user has explicitly opted in to receiving the Excel workbook. Generate a detailed Excel spreadsheet with a workflow_excel uiBlock based on the analysis above. Include ALL numbers, values, costs, and data points mentioned. If specific numbers were not available, estimate realistic values based on typical U.S. market data for the described scenario, region, and property type. NEVER leave cost cells empty — always fill with estimated values. Every row must have numeric values in cost/value columns.` }
              ],
              conversationMode: true
            }
          });

          // Handle both object and string responses from ai-chat
          let parsedResponse = excelData?.response;
          if (typeof parsedResponse === 'string') {
            try { parsedResponse = JSON.parse(parsedResponse); } catch { parsedResponse = null; }
          }
          const excelBlock = excelData?.uiBlock || parsedResponse?.uiBlock;
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
        "flex-1 pb-24 transition-all duration-200",
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
              <Card className="p-4">
                <p className="text-sm font-medium">
                  Upload a document
                </p>
                <p className="text-xs text-muted-foreground">Attach a contract, inspection report, or loan estimate and ask questions about it</p>
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
                  className={`relative group/bubble max-w-[85%] rounded-lg px-4 py-3 ${
                  message.role === 'user' ?
                  'bg-primary text-primary-foreground' :
                  'bg-muted'}`
                  }>
                  {message.role === 'user' && message.content && (
                    <MessageActions
                      text={message.content}
                      side="right"
                      onEdit={() => handleEditUserMessage(message.id)}
                    />
                  )}

                  {/* Attachment badges for user messages */}
                  {message.role === 'user' && message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {message.attachments.map((att, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-primary-foreground/20 text-primary-foreground rounded px-2 py-0.5 text-[10px] sm:text-xs">
                          {att.mimeType.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                          <span className="truncate max-w-[120px]">{att.name}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {message.role === 'assistant' ?
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                      {/* Match Score Badge */}
                      {message.metadata?.matchScore != null && (
                        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg border bg-background/50">
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <svg width="48" height="48" viewBox="0 0 48 48">
                              <circle cx="24" cy="24" r="19" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                              <circle
                                cx="24" cy="24" r="19"
                                fill="none"
                                stroke={getScoreColor(message.metadata.matchScore)}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={`${(message.metadata.matchScore / 10) * (2 * Math.PI * 19)} ${2 * Math.PI * 19}`}
                                transform="rotate(-90 24 24)"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: getScoreColor(message.metadata.matchScore) }}>
                              {message.metadata.matchScore}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold" style={{ color: getScoreColor(message.metadata.matchScore) }}>
                              {getScoreLabel(message.metadata.matchScore)}
                            </div>
                            <div className="text-xs text-muted-foreground">Property Match Score</div>
                          </div>
                        </div>
                      )}
                      <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={chatMarkdownComponents}>

                        {message.content.replace(/\[\d+\]/g, '')}
                      </ReactMarkdown>
                      
                      {/* Listen to response */}
                      {message.content && (
                        <div className="flex justify-end mt-1">
                          <TextToSpeechButton text={message.content} />
                        </div>
                      )}
                      
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

                      {/* Save Analysis Button — only on real property analyses (MATCH_SCORE present) */}
                      {message.metadata?.matchScore != null && (
                        <SaveAnalysisButton
                          analysis={{
                            propertyUrl: analysisUrl ?? null,
                            propertyAddress:
                              (message.metadata as any)?.analyzedProperty?.address ?? null,
                            propertyPrice: null,
                            analysisSummary: message.content,
                            investmentScore: Math.round(
                              message.metadata.matchScore * 10,
                            ),
                            scoreLabel: getScoreLabel(message.metadata.matchScore),
                            keyMetrics:
                              (message.metadata as any)?.analyzedProperty ?? null,
                            source: "app",
                          }}
                        />
                      )}

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
          placeholder="Ask something..."
          showVoice={true}
          value={pendingInput}
          onValueChange={setPendingInput} />
      </div>
    </div>);

}