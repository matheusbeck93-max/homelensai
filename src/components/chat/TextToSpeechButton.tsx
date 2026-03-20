import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TextToSpeechButtonProps {
  text: string;
  className?: string;
}

export function TextToSpeechButton({ text, className }: TextToSpeechButtonProps) {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const cleanTextForSpeech = (raw: string): string => {
    return raw
      .replace(/\[?\d+\]?/g, '')           // citation markers
      .replace(/[*#_~`>|]/g, '')            // markdown chars
      .replace(/!\[.*?\]\(.*?\)/g, '')      // images
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links → text only
      .replace(/https?:\/\/\S+/g, '')       // bare URLs
      .replace(/\n{2,}/g, '. ')             // paragraph breaks → pause
      .replace(/\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const togglePlayback = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      toast({
        title: "Not supported",
        description: "Your browser doesn't support text-to-speech",
        variant: "destructive",
      });
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    setIsLoading(true);

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    // Pick a good voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('google')
    ) || voices.find((v) => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [text, isPlaying, toast]);

  if (!('speechSynthesis' in window)) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={togglePlayback}
      className={className}
      title={isPlaying ? "Stop listening" : "Listen to response"}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isPlaying ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
