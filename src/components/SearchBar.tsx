import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Try: Find 3-bedroom fixers under $650k in Arlington with ROI over 15%"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-4 py-6 text-lg border-2 focus:border-primary"
            disabled={loading}
          />
        </div>
        <Button 
          type="submit" 
          size="lg" 
          disabled={loading || !query.trim()}
          className="h-[56px] px-8"
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
