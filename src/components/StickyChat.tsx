import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Sparkles } from "lucide-react";
import { VoiceInputButton } from "@/components/chat/VoiceInputButton";

interface StickyChatProps {
  onSend: (message: string) => void;
  loading?: boolean;
  placeholder?: string;
  showVoice?: boolean;
}

export function StickyChat({ 
  onSend, 
  loading, 
  placeholder = "Ask about properties, mortgages, investments, or paste a property link...",
  showVoice = false
}: StickyChatProps) {
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

  const handleVoiceTranscript = (transcript: string) => {
    setInput(transcript);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50 pb-safe">
      <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-2 sm:py-3">
        <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            disabled={loading}
            className="min-h-[44px] sm:min-h-[52px] md:min-h-[60px] max-h-[80px] sm:max-h-[100px] md:max-h-[120px] resize-none text-xs sm:text-sm md:text-base"
            rows={2}
          />
          {showVoice && (
            <VoiceInputButton 
              onTranscript={handleVoiceTranscript}
              disabled={loading}
            />
          )}
          <Button 
            type="submit"
            disabled={loading || !input.trim()}
            size="icon"
            className="h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] md:h-[60px] md:w-[60px] flex-shrink-0"
          >
            {loading ? (
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-pulse" />
            ) : (
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
