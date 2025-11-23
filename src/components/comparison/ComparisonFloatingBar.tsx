import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ArrowRight, Home } from "lucide-react";
import { useComparison } from "@/contexts/ComparisonContext";
import { formatCurrency } from "@/lib/calculations";

interface ComparisonFloatingBarProps {
  onCompare: () => void;
}

export function ComparisonFloatingBar({ onCompare }: ComparisonFloatingBarProps) {
  const { selectedProperties, removeFromComparison, clearComparison } = useComparison();

  if (selectedProperties.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-0 right-0 z-40 px-4">
      <Card className="max-w-4xl mx-auto p-4 shadow-2xl border-2 border-primary/20 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-sm">
                Compare Properties ({selectedProperties.length}/4)
              </h3>
              {selectedProperties.length < 2 && (
                <span className="text-xs text-muted-foreground">
                  Select at least 2 properties
                </span>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {selectedProperties.map((property) => (
                <div
                  key={property.id}
                  className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg min-w-fit group"
                >
                  {property.photoUrl ? (
                    <img
                      src={property.photoUrl}
                      alt={property.address}
                      className="w-8 h-8 rounded object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted-foreground/10 flex items-center justify-center">
                      <Home className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium truncate max-w-[120px]">
                      {property.address}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {property.price ? formatCurrency(property.price) : 'N/A'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFromComparison(property.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearComparison}
            >
              Clear
            </Button>
            <Button
              onClick={onCompare}
              disabled={selectedProperties.length < 2}
              className="gap-2"
            >
              Compare Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
