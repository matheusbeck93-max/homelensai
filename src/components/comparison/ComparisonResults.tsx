import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, TrendingUp, TrendingDown, Home, Bed, Bath, Square } from "lucide-react";
import { HomeLensListing } from "@/types/ui-blocks";
import { formatCurrency } from "@/lib/calculations";
import ReactMarkdown from "react-markdown";

interface ComparisonResultsProps {
  properties: HomeLensListing[];
  analysis: string;
  onClose: () => void;
}

export function ComparisonResults({ properties, analysis, onClose }: ComparisonResultsProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Card className="shadow-2xl">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">Property Comparison Report</CardTitle>
                <CardDescription>
                  AI-powered analysis of {properties.length} properties
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Property Summary Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {properties.map((property) => (
                <Card key={property.id} className="overflow-hidden">
                  <div className="aspect-video relative bg-muted">
                    {property.photoUrl ? (
                      <img
                        src={property.photoUrl}
                        alt={property.address}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="h-12 w-12 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <p className="font-bold text-primary">
                        {property.price ? formatCurrency(property.price) : 'N/A'}
                      </p>
                      <p className="text-xs font-medium truncate">{property.address}</p>
                      <p className="text-xs text-muted-foreground">
                        {property.city}, {property.state}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {property.beds && (
                        <div className="flex items-center gap-1">
                          <Bed className="h-3 w-3" />
                          {property.beds}
                        </div>
                      )}
                      {property.baths && (
                        <div className="flex items-center gap-1">
                          <Bath className="h-3 w-3" />
                          {property.baths}
                        </div>
                      )}
                      {property.sqft && (
                        <div className="flex items-center gap-1">
                          <Square className="h-3 w-3" />
                          {property.sqft.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* AI Analysis */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Comparison Analysis
              </h3>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h2 className="text-xl font-bold mt-6 mb-3">{children}</h2>,
                    h2: ({ children }) => <h3 className="text-lg font-semibold mt-5 mb-2">{children}</h3>,
                    h3: ({ children }) => <h4 className="text-base font-semibold mt-4 mb-2">{children}</h4>,
                    ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-3">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-3">{children}</ol>,
                    li: ({ children }) => <li className="text-sm">{children}</li>,
                    p: ({ children }) => <p className="text-sm leading-relaxed my-2">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  }}
                >
                  {analysis}
                </ReactMarkdown>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
