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
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 space-y-3 sm:space-y-4 md:space-y-6">
      {messages.map((message) => (
        <div key={message.id}>
          {/* User Message */}
          {message.role === "user" && (
            <div className="flex justify-end gap-1.5 sm:gap-2 md:gap-3 mb-3 sm:mb-4 md:mb-6">
              <div className="max-w-[90%] sm:max-w-[85%] md:max-w-[80%] rounded-xl sm:rounded-2xl bg-primary text-primary-foreground px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3">
                <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{message.content}</p>
              </div>
              <div className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-secondary-foreground" />
              </div>
            </div>
          )}

          {/* Assistant Message */}
          {message.role === "assistant" && (
            <div className="flex gap-1.5 sm:gap-2 md:gap-3 mb-3 sm:mb-4 md:mb-6">
              <div className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 space-y-2 sm:space-y-3 md:space-y-4 min-w-0">
                {/* Text Content */}
                {message.content && (
                  <div className="rounded-xl sm:rounded-2xl bg-muted px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 prose prose-sm max-w-none overflow-x-auto text-xs sm:text-sm break-words">
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium" />
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
                
                {/* UI Block (Carousel, Calculator, etc.) */}
                {message.uiBlock && (
                  <div className="mt-2 sm:mt-3 md:mt-4">
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
        <div className="flex gap-1.5 sm:gap-2 md:gap-3">
          <div className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-primary-foreground animate-pulse" />
          </div>
          <div className="bg-muted rounded-xl sm:rounded-2xl px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3">
            <p className="text-xs sm:text-sm text-muted-foreground">Pensando...</p>
          </div>
        </div>
      )}

      <div ref={scrollRef} />
    </div>
  );
}
