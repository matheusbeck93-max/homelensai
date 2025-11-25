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
    <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50">
      <div className="w-full max-w-5xl mx-auto px-4 py-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            disabled={loading}
            className="min-h-[60px] max-h-[120px] resize-none"
            rows={2}
          />
          <Button 
            type="submit"
            disabled={loading || !input.trim()}
            size="icon"
            className="h-[60px] w-[60px] flex-shrink-0"
          >
            {loading ? (
              <Sparkles className="h-5 w-5 animate-pulse" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
