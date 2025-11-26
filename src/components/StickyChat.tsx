import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Sparkles } from "lucide-react";

interface StickyChatProps {
  onSend: (message: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export function StickyChat({ onSend, loading, placeholder = "Ask about properties, mortgages, investments, or paste a property link..." }: StickyChatProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50 pb-safe">
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            disabled={loading}
            className="min-h-[50px] sm:min-h-[60px] max-h-[100px] sm:max-h-[120px] resize-none text-sm sm:text-base"
            rows={2}
          />
          <Button 
            type="submit"
            disabled={loading || !input.trim()}
            size="icon"
            className="h-[50px] w-[50px] sm:h-[60px] sm:w-[60px] flex-shrink-0"
          >
            {loading ? (
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse" />
            ) : (
              <Send className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
