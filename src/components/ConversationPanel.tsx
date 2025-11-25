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
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-6">
      {messages.map((message) => (
        <div key={message.id}>
          {/* User Message */}
          {message.role === "user" && (
            <div className="flex justify-end gap-3 mb-6">
              <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-3">
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-secondary-foreground" />
              </div>
            </div>
          )}

          {/* Assistant Message */}
          {message.role === "assistant" && (
            <div className="flex gap-3 mb-6">
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 space-y-4">
                {/* Text Content */}
                {message.content && (
                  <div className="rounded-2xl bg-muted px-4 py-3 prose prose-sm max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
                
                {/* UI Block (Carousel, Calculator, etc.) */}
                {message.uiBlock && (
                  <div className="mt-4">
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
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Bot className="h-5 w-5 text-primary-foreground animate-pulse" />
          </div>
          <div className="bg-muted rounded-2xl px-4 py-3">
            <p className="text-sm text-muted-foreground">Thinking...</p>
          </div>
        </div>
      )}

      <div ref={scrollRef} />
    </div>
  );
}
