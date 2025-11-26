import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Minimize2, Maximize2, Bed, Bath, Square, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

interface PropertyLink {
  source: string;
  url: string;
  title: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  type?: "text" | "links";
  links?: PropertyLink[];
}

interface Property {
  id: string;
  address: string;
  city?: string | null;
  state?: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  image_urls?: string[];
  photoUrl?: string | null;
  image_url?: string;
  description?: string;
  externalLink?: string;
  listingUrl?: string | null;
  status?: string | null;
}

interface MarketSnapshot {
  areaLabel: string;
  zip?: string | null;
  city?: string | null;
  state?: string | null;
  medianRent?: number | null;
  medianHomeValue?: number | null;
  rentToPriceRatio?: number | null;
  trendLabel?: string | null;
  medianHouseholdIncome?: number | null;
  ownerOccupiedRate?: number | null;
  renterOccupiedRate?: number | null;
  medianAge?: number | null;
  averageHouseholdSize?: number | null;
  hasRentcastData: boolean;
  hasCensusData: boolean;
}

interface FollowUpChatProps {
  context?: string;
  properties?: Property[];
  marketSnapshot?: MarketSnapshot | null;
}

export default function FollowUpChat({ context, properties = [], marketSnapshot }: FollowUpChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Detect if query is a property search
  const isPropertySearch = (text: string): boolean => {
    const keywords = /(find|search|looking for|looking to buy|for sale|house|apartment|bedroom|beds|bath|realtor|zillow|redfin|home|property|condo|townhouse)/i;
    const pricePattern = /\$?\s?\d{1,3}(?:[,.]\d{3})*(?:\s?M|\s?k)?/i;
    const locationPattern = /(in|near|around|at)\s+[A-Z][a-z]+/i;
    return keywords.test(text) || (pricePattern.test(text) && locationPattern.test(text));
  };

  // Build Google fallback URLs
  const buildSiteSearchUrls = (queryText: string): PropertyLink[] => {
    const sites = [
      { domain: "zillow.com", name: "Zillow" },
      { domain: "realtor.com", name: "Realtor.com" },
      { domain: "redfin.com", name: "Redfin" },
    ];
    const cleanQuery = queryText.replace(/find|search|looking for|looking to buy/gi, "").trim();
    const encodedQuery = encodeURIComponent(cleanQuery);
    return sites.map((site) => ({
      source: site.name,
      url: `https://www.google.com/search?q=site:${site.domain}+${encodedQuery}`,
      title: `${site.name} - ${cleanQuery}`,
    }));
  };

  // Sanitiza o texto do backend sem remover conteúdo legítimo
  const cleanAssistantText = (str: string): string => {
    if (!str) return "";
    // Remove blocos JSON inteiros
    return str.replace(/```json[\s\S]*?```/g, "")
              .replace(/(\{[\s\S]*?\}|\[[\s\S]*?\])/g, "")
              .trim();
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input, type: "text" };
    setMessages((prev) => [...prev, userMessage]);

    const userInput = input;
    setInput("");
    setLoading(true);

    try {
      if (isPropertySearch(userInput)) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Buscando imóveis para: "${userInput}"...`, type: "text" },
        ]);

        let backendLinks: PropertyLink[] | null = null;

        try {
          const { data, error } = await supabase.functions.invoke("property-assistant", {
            body: { query: userInput, marketSnapshot: marketSnapshot || undefined },
          });

          if (!error && data?.links && Array.isArray(data.links)) {
            // filtra apenas links válidos
            backendLinks = data.links.filter(
              (l: any) => l && l.url && typeof l.url === "string" && l.url.startsWith("http")
            );
          }
        } catch (e) {}

        if (backendLinks && backendLinks.length > 0) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Encontrei estas opções:", type: "links", links: backendLinks.slice(0, 5) },
          ]);
          setLoading(false);
          return;
        }

        const fallbackLinks = buildSiteSearchUrls(userInput);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Não consegui links diretos, mas aqui estão pesquisas úteis:", type: "links", links: fallbackLinks },
        ]);

      } else {
        let contextPrompt = userInput;

        if (selectedProperty) {
          contextPrompt = `Property Context: ${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state} - $${selectedProperty.price}\n\nUser question: ${userInput}`;
        } else if (context) {
          contextPrompt = `Context: ${context}\n\nUser question: ${userInput}`;
        }

        const { data, error } = await supabase.functions.invoke("property-assistant", {
          body: { query: contextPrompt, marketSnapshot: marketSnapshot || undefined },
        });

        if (error) throw error;

        if (data?.links && Array.isArray(data.links)) {
          const valid = data.links.filter(
            (l: any) => l && l.url && typeof l.url === "string" && l.url.startsWith("http")
          );
          if (valid.length > 0) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "Aqui estão algumas opções:", type: "links", links: valid.slice(0, 5) },
            ]);
            setLoading(false);
            return;
          }
        }

        const cleaned = cleanAssistantText(data?.response || "");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              cleaned || "Desculpe, não entendi completamente sua solicitação. Pode reformular?",
            type: "text",
          },
        ]);
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePropertySelect = (property: Property) => {
    setSelectedProperty(property);
    toast({ title: "Property Selected", description: `Ask me anything about ${property.address}` });
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(price);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card
      className={`sticky bottom-0 left-0 right-0 mx-auto shadow-2xl transition-all duration-300 z-10 ${
        isExpanded ? "w-[90vw] max-w-[800px] h-[80vh]" : "w-full max-w-[800px] h-auto"
      }`}
    >
      <div className="flex flex-col h-full">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-3 border-b bg-primary/5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">
              {selectedProperty ? `Asking about ${selectedProperty.address}` : "Ask Follow-up Questions"}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="h-8 w-8">
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* PROPERTY CAROUSEL */}
        {isExpanded && properties.length > 0 && (
          <div className="border-b p-4 bg-muted/30">
            <Carousel className="w-full">
              <CarouselContent>
                {properties.map((property) => (
                  <CarouselItem key={property.id} className="md:basis-1/2 lg:basis-1/3">
                    <Card
                      className={`overflow-hidden transition-all ${
                        selectedProperty?.id === property.id ? "ring-2 ring-primary" : "hover:shadow-lg"
                      }`}
                    >
                      <div className="aspect-video relative overflow-hidden">
                        <img
                          src={
                            property.image_urls?.[0] ||
                            property.image_url ||
                            "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"
                          }
                          alt={property.address}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-lg font-bold text-primary mb-1">{formatPrice(property.price!)}</p>
                        <p className="text-xs font-medium mb-1 line-clamp-1">{property.address}</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          {property.city}, {property.state}
                        </p>

                        <div className="flex items-center gap-3 text-xs mb-3">
                          <div className="flex items-center gap-1">
                            <Bed className="h-3 w-3" />
                            <span>{property.beds}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Bath className="h-3 w-3" />
                            <span>{property.baths}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Square className="h-3 w-3" />
                            <span>{property.sqft}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={() => handlePropertySelect(property)} size="sm" className="flex-1">
                            Analisar
                          </Button>

                          {property.externalLink && (
                            <Button asChild size="sm" variant="outline" className="flex-1">
                              <a href={property.externalLink} target="_blank">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Ver Anúncio
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
        )}

        {/* CHAT MESSAGES */}
        {isExpanded && (
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>Ask me anything about the properties you're viewing!</p>
                </div>
              )}

              {messages.map((msg, index) => (
                <div key={index} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.type === "links" && msg.links ? (
                      <div className="space-y-3">
                        <p className="font-medium mb-2">{msg.content}</p>
                        {msg.links.map((link, i) => (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-background hover:bg-accent transition"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs">{link.source}</p>
                              <p className="text-xs text-muted-foreground truncate">{link.title}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-5 w-5 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary-foreground animate-pulse" />
                  </div>
                  <div className="bg-muted rounded-2xl p-3">
                    <p className="text-sm text-muted-foreground">Thinking...</p>
                  </div>
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        )}

        {/* INPUT AREA */}
        <div className="p-3 border-t bg-background">
          <div className="flex gap-2">
            <Textarea
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={loading}
              className="min-h-[60px] resize-none"
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="h-[60px]">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </div>
    </Card>
  );
}
