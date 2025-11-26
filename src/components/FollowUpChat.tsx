import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Minimize2, Maximize2, Bed, Bath, Square, DollarSign, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

interface Message {
  role: "user" | "assistant";
  content: string;
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

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      let contextPrompt = input;
      
      if (selectedProperty) {
        contextPrompt = `Property Context: ${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state} - $${selectedProperty.price.toLocaleString()}, ${selectedProperty.beds} beds, ${selectedProperty.baths} baths, ${selectedProperty.sqft} sqft\n\nUser question: ${input}`;
      } else if (context) {
        contextPrompt = `Context: ${context}\n\nUser question: ${input}`;
      }

      const { data, error } = await supabase.functions.invoke("property-assistant", {
        body: { 
          query: contextPrompt,
          marketSnapshot: marketSnapshot || undefined
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
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

  const handlePropertySelect = (property: Property) => {
    setSelectedProperty(property);
    toast({
      title: "Property Selected",
      description: `Ask me anything about ${property.address}`,
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

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
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-primary/5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">
              {selectedProperty ? `Asking about ${selectedProperty.address}` : "Ask Follow-up Questions"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8"
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Property Carousel - Only show when expanded and properties exist */}
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
                          src={property.image_urls?.[0] || property.image_url || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"}
                          alt={property.address}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-lg font-bold text-primary mb-1">
                          {formatPrice(property.price)}
                        </p>
                        <p className="text-xs font-medium mb-1 line-clamp-1">
                          {property.address}
                        </p>
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
                          <Button 
                            onClick={() => handlePropertySelect(property)}
                            size="sm"
                            className="flex-1"
                          >
                            Analisar
                          </Button>
                          {property.externalLink && (
                            <Button 
                              asChild
                              size="sm"
                              variant="outline"
                              className="flex-1"
                            >
                              <a href={property.externalLink} target="_blank" rel="noopener noreferrer">
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

        {/* Messages - Only show when expanded */}
        {isExpanded && (
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>Ask me anything about the properties you're viewing!</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
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

        {/* Input Area */}
        <div className="p-3 border-t bg-background">
          <div className="flex gap-2">
            <Textarea
              placeholder="Ask about pricing, neighborhoods, features..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={loading}
              className="min-h-[60px] resize-none"
              rows={isExpanded ? 2 : 1}
            />
            <Button 
              onClick={handleSend} 
              disabled={loading || !input.trim()} 
              size="icon"
              className="h-[60px]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
