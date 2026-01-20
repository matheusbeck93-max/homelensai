import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, Scale, ExternalLink, Trash2, Plus, Loader2, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

export interface AnalyzedProperty {
  id: string;
  url: string;
  price?: string;
  address?: string;
  bedrooms?: string;
  bathrooms?: string;
  size?: string;
  hoa?: string;
  taxes?: string;
  yearBuilt?: string;
  propertyType?: string;
  keyFeatures?: string[];
  rawAnalysis: string;
}

interface ChatComparisonPanelProps {
  properties: AnalyzedProperty[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
  onAddProperty?: (property: AnalyzedProperty) => void;
}

// Parse analyzed property data from assistant message
function parseAnalyzedProperty(content: string, url: string): AnalyzedProperty | null {
  const extractField = (pattern: RegExp): string | undefined => {
    const match = content.match(pattern);
    return match ? match[1].trim() : undefined;
  };

  const property: AnalyzedProperty = {
    id: uuidv4(),
    url,
    rawAnalysis: content,
    price: extractField(/Price:\s*([^\n]+)/i),
    address: extractField(/Address:\s*([^\n]+)/i),
    bedrooms: extractField(/Bedrooms?:\s*([^\n]+)/i),
    bathrooms: extractField(/Bathrooms?:\s*([^\n]+)/i),
    size: extractField(/Size:\s*([^\n]+)/i),
    hoa: extractField(/HOA:\s*([^\n]+)/i),
    taxes: extractField(/Taxes?:\s*([^\n]+)/i),
    yearBuilt: extractField(/Year\s*[Bb]uilt:\s*([^\n]+)/i),
    propertyType: extractField(/Property\s*[Tt]ype:\s*([^\n]+)/i),
  };

  // Extract key features
  const featuresMatch = content.match(/Key\s*[Ff]eatures?:([^•\n]*(?:•[^\n]+\n?)*)/i);
  if (featuresMatch) {
    property.keyFeatures = featuresMatch[1]
      .split(/[•\-\n]/)
      .map(f => f.trim())
      .filter(f => f.length > 0 && f.length < 50);
  }

  return property;
}

export function ChatComparisonPanel({ 
  properties, 
  onRemove, 
  onClear, 
  onClose,
  onAddProperty
}: ChatComparisonPanelProps) {
  const [newUrl, setNewUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const handleAddLink = async () => {
    if (!newUrl.trim()) return;

    // Validate URL
    const urlPattern = /^https?:\/\/(www\.)?(zillow|redfin|realtor)\.(com)\/.+/i;
    if (!urlPattern.test(newUrl)) {
      toast.error("Please enter a valid Zillow, Redfin, or Realtor.com listing URL");
      return;
    }

    // Check if already added
    if (properties.some(p => p.url === newUrl)) {
      toast.error("This property is already in the comparison");
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('perplexity-chat', {
        body: {
          query: newUrl,
          conversationHistory: []
        }
      });

      if (error) throw error;

      const parsed = parseAnalyzedProperty(data?.message || '', newUrl);
      if (parsed && onAddProperty) {
        onAddProperty(parsed);
        setNewUrl("");
        toast.success("Property added to comparison");
      } else {
        toast.error("Could not analyze this property. Please try a different listing.");
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || "Failed to analyze property");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !analyzing) {
      handleAddLink();
    }
  };

  if (properties.length === 0 && !onAddProperty) return null;

  const formatValue = (value?: string) => value || "Not listed";

  return (
    <Card className="border-t-0 rounded-t-none">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Compare Properties ({properties.length})</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Add New Property Input */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Paste a Zillow, Redfin, or Realtor.com link..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={analyzing}
              className="pr-10"
            />
            {analyzing && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button 
            onClick={handleAddLink} 
            disabled={!newUrl.trim() || analyzing}
            size="icon"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Add another property link to compare side-by-side
        </p>
      </div>

      {properties.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Add a property link above to start comparing</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="p-4 overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground w-32">Property</th>
                  {properties.map((prop) => (
                    <th key={prop.id} className="text-left py-2 px-2 min-w-[200px]">
                      <div className="flex items-center justify-between">
                        <a 
                          href={prop.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm font-medium flex items-center gap-1 truncate max-w-[150px]"
                        >
                          {prop.address || "View Listing"}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => onRemove(prop.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm">
                <ComparisonRow label="Price" properties={properties} field="price" highlight />
                <ComparisonRow label="Property Type" properties={properties} field="propertyType" />
                <ComparisonRow label="Bedrooms" properties={properties} field="bedrooms" />
                <ComparisonRow label="Bathrooms" properties={properties} field="bathrooms" />
                <ComparisonRow label="Size" properties={properties} field="size" />
                <ComparisonRow label="Year Built" properties={properties} field="yearBuilt" />
                <ComparisonRow label="HOA" properties={properties} field="hoa" />
                <ComparisonRow label="Taxes" properties={properties} field="taxes" />
                <tr className="border-b">
                  <td className="py-2 px-2 font-medium text-muted-foreground align-top">Key Features</td>
                  {properties.map((prop) => (
                    <td key={prop.id} className="py-2 px-2 align-top">
                      {prop.keyFeatures && prop.keyFeatures.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {prop.keyFeatures.slice(0, 5).map((feature, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not listed</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}

function ComparisonRow({ 
  label, 
  properties, 
  field, 
  highlight 
}: { 
  label: string; 
  properties: AnalyzedProperty[]; 
  field: keyof AnalyzedProperty;
  highlight?: boolean;
}) {
  return (
    <tr className="border-b">
      <td className="py-2 px-2 font-medium text-muted-foreground">{label}</td>
      {properties.map((prop) => {
        const value = prop[field];
        const displayValue = typeof value === 'string' ? value : "Not listed";
        return (
          <td 
            key={prop.id} 
            className={`py-2 px-2 ${highlight ? 'font-semibold text-primary' : ''}`}
          >
            {displayValue || "Not listed"}
          </td>
        );
      })}
    </tr>
  );
}
