import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles } from "lucide-react";
import { searchQuerySchema } from "@/lib/validation";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) return;

    try {
      // Validate search query
      searchQuerySchema.parse({ query: trimmedQuery });
      onSearch(trimmedQuery);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid Search",
          description: error.issues[0].message,
          variant: "destructive",
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Try: Find 3-bedroom fixers under $650k in Arlington with ROI over 15%"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-4 py-5 sm:py-6 text-base sm:text-lg border-2 focus:border-primary w-full"
            disabled={loading}
          />
        </div>
        <Button 
          type="submit" 
          size="lg" 
          disabled={loading || !query.trim()}
          className="h-[48px] sm:h-[56px] px-6 sm:px-8 w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Sparkles className="mr-2 h-5 w-5 animate-pulse" />
              Searching...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Search
            </>
          )}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-2 text-center">
        Powered by AI - Search using natural language
      </p>
    </form>
  );
}
