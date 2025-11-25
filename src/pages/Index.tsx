import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/Navigation";
import { SearchBar } from "@/components/SearchBar";
import { ConversationPanel, ConversationMessage } from "@/components/ConversationPanel";
import { StickyChat } from "@/components/StickyChat";
import { HouseHeroAnimation } from "@/components/HouseHeroAnimation";
import { HomeLensListing, UIBlock } from "@/types/ui-blocks";
import { isPropertySearchQuery, parsePropertySearchQuery, parseLocationComponents } from "@/utils/propertySearchHelpers";
import { useQuery } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [searchParams, setSearchParams] = useState<any>(null);

  // React Query for property search
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['property-search', searchParams],
    queryFn: async () => {
      if (!searchParams) return null;
      const { data, error } = await supabase.functions.invoke('search-listings', {
        body: searchParams
      });
      if (error) throw error;
      return data;
    },
    enabled: !!searchParams,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  // Process search results into conversation
  useEffect(() => {
    if (searchData && searchParams) {
      const listings = searchData.listings || [];
      
      if (listings.length > 0) {
        const uiBlock: UIBlock = {
          type: 'ui_block/property_results_carousel',
          title: `Found ${listings.length} homes${searchParams.location ? ` in ${searchParams.location}` : ''}`,
          properties: listings
        };

        const assistantMessage: ConversationMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: `I found ${listings.length} properties matching your search criteria.`,
          uiBlock,
          createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const assistantMessage: ConversationMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: 'No properties found matching your criteria. Try adjusting your search filters.',
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    }
  }, [searchData, searchParams]);

  const handleSendMessage = async (messageText: string) => {
    // Add user message
    const userMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    // Check if it's a property search query
    if (isPropertySearchQuery(messageText)) {
      const parsedParams = parsePropertySearchQuery(messageText);
      if (parsedParams && parsedParams.location) {
        const locationComponents = parseLocationComponents(parsedParams.location);
        setSearchParams({
          ...parsedParams,
          ...locationComponents
        });
        return;
      }
    }

    // Otherwise, send to AI chat
    setConversationLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: messages.concat(userMessage).map(m => ({
            role: m.role,
            content: m.content
          })),
          conversationMode: true
        }
      });

      if (error) throw error;

      // Check if response indicates need for search
      if (data.needsSearch) {
        const assistantMessage: ConversationMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: data.message || 'Please use the search bar above to find properties.',
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Regular text response
        const assistantMessage: ConversationMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: data.response || 'I apologize, I couldn\'t process that request.',
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error: any) {
      console.error('AI chat error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setConversationLoading(false);
    }
  };

  const handlePropertyAnalyze = (property: any) => {
    const message = `Analyze this property: ${property.address}, ${property.city}, ${property.state}. Price: $${property.price?.toLocaleString()}, ${property.beds} beds, ${property.baths} baths, ${property.sqft} sqft.`;
    handleSendMessage(message);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background pb-24">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        <HouseHeroAnimation />
        <div className="relative z-10 text-center px-4 py-20 max-w-5xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-foreground">
            Find Your Dream Home
          </h1>
          <p className="text-lg sm:text-xl mb-8 text-muted-foreground max-w-2xl mx-auto">
            AI-powered real estate search and analysis. Ask me anything about properties, mortgages, or investments.
          </p>

          {/* Main Search Bar */}
          <SearchBar onSearch={handleSendMessage} loading={searchLoading || conversationLoading} />
        </div>
      </section>

      {/* Conversation Panel */}
      <ConversationPanel
        messages={messages}
        loading={conversationLoading}
        onPropertyAnalyze={handlePropertyAnalyze}
      />

      {/* Empty State when no conversation */}
      {messages.length === 0 && (
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto text-center space-y-8">
            <h2 className="text-2xl font-semibold">How can I help you today?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => handleSendMessage("Find 3-bedroom homes under $500k in Austin, Texas")}
                className="p-6 border rounded-lg hover:bg-muted cursor-pointer transition"
              >
                <h3 className="font-semibold mb-2">Search for homes</h3>
                <p className="text-sm text-muted-foreground">
                  "Find 3-bedroom homes under $500k in Austin, Texas"
                </p>
              </div>
              <div
                onClick={() => handleSendMessage("What mortgage rate can I get?")}
                className="p-6 border rounded-lg hover:bg-muted cursor-pointer transition"
              >
                <h3 className="font-semibold mb-2">Calculate mortgage</h3>
                <p className="text-sm text-muted-foreground">
                  "What mortgage rate can I get?"
                </p>
              </div>
              <div
                onClick={() => handleSendMessage("How do I calculate ROI on a rental property?")}
                className="p-6 border rounded-lg hover:bg-muted cursor-pointer transition"
              >
                <h3 className="font-semibold mb-2">Investment advice</h3>
                <p className="text-sm text-muted-foreground">
                  "How do I calculate ROI on a rental property?"
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Sticky Chat Input */}
      <StickyChat
        onSend={handleSendMessage}
        loading={conversationLoading || searchLoading}
      />

      {/* Footer */}
      <footer className="bg-muted py-8 mt-auto">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 HomeLens. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
