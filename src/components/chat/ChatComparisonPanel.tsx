import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Scale, ExternalLink, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

export function ChatComparisonPanel({ 
  properties, 
  onRemove, 
  onClear, 
  onClose 
}: ChatComparisonPanelProps) {
  if (properties.length === 0) return null;

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
