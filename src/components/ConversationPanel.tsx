import React, { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { UIBlockRenderer } from "@/components/ui-blocks/UIBlockRenderer";
import { UIBlock } from "@/types/ui-blocks";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  uiBlock?: UIBlock | null;
  createdAt: string;
}

interface ConversationPanelProps {
  messages: ConversationMessage[];
  loading?: boolean;
  onPropertyAnalyze?: (property: any) => void;
}

export function ConversationPanel({ messages, loading, onPropertyAnalyze }: ConversationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6">
      {messages.map((message) => (
        <div key={message.id}>
          {/* User Message */}
          {message.role === "user" && (
            <div className="flex justify-end gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="max-w-[85%] sm:max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-3">
                <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{message.content}</p>
              </div>
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-secondary-foreground" />
              </div>
            </div>
          )}

          {/* Assistant Message */}
          {message.role === "assistant" && (
            <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
                {/* Text Content */}
                {message.content && (
                  <div className="rounded-2xl bg-muted px-3 sm:px-4 py-2 sm:py-3 prose prose-sm max-w-none overflow-x-auto text-xs sm:text-sm break-words">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
                
                {/* UI Block (Carousel, Calculator, etc.) */}
                {message.uiBlock && (
                  <div className="mt-3 sm:mt-4">
                    <UIBlockRenderer block={message.uiBlock} onPropertyAnalyze={onPropertyAnalyze} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Loading State */}
      {loading && (
        <div className="flex gap-2 sm:gap-3">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground animate-pulse" />
          </div>
          <div className="bg-muted rounded-2xl px-3 sm:px-4 py-2 sm:py-3">
            <p className="text-xs sm:text-sm text-muted-foreground">Thinking...</p>
          </div>
        </div>
      )}

      <div ref={scrollRef} />
    </div>
  );
}
