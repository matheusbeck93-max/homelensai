import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, TrendingUp, Home, DollarSign } from "lucide-react";

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  image_urls: string[];
  roi_percent?: number;
  arv?: number;
  condition?: string;
}

interface PropertyComparisonProps {
  properties: Property[];
  onRemove: (propertyId: string) => void;
  onClear: () => void;
}

export function PropertyComparison({ properties, onRemove, onClear }: PropertyComparisonProps) {
  if (properties.length === 0) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const pricePerSqft = (property: Property) => {
    return (property.price / property.sqft).toFixed(0);
  };

  const avgPrice = properties.reduce((sum, p) => sum + p.price, 0) / properties.length;
  const avgSqft = properties.reduce((sum, p) => sum + p.sqft, 0) / properties.length;
  const avgPricePerSqft = properties.reduce((sum, p) => sum + (p.price / p.sqft), 0) / properties.length;

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Property Comparison ({properties.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Property</th>
                {properties.map((property) => (
                  <th key={property.id} className="py-3 px-2 min-w-[200px]">
                    <div className="space-y-2">
                      <img
                        src={property.image_urls[0] || '/placeholder.svg'}
                        alt={property.address}
                        className="w-full h-24 object-cover rounded"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(property.id)}
                        className="w-full"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-3 px-2 text-sm font-medium">Address</td>
                {properties.map((property) => (
                  <td key={property.id} className="py-3 px-2 text-sm">
                    {property.address}
                    <div className="text-xs text-muted-foreground">
                      {property.city}, {property.state}
                    </div>
                  </td>
                ))}
              </tr>

              <tr className="border-b bg-muted/30">
                <td className="py-3 px-2 text-sm font-medium">Price</td>
                {properties.map((property) => (
                  <td key={property.id} className="py-3 px-2">
                    <div className="text-lg font-bold text-primary">
                      {formatPrice(property.price)}
                    </div>
                    {property.price < avgPrice && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        Below Avg
                      </Badge>
                    )}
                  </td>
                ))}
              </tr>

              <tr className="border-b">
                <td className="py-3 px-2 text-sm font-medium">Beds / Baths</td>
                {properties.map((property) => (
                  <td key={property.id} className="py-3 px-2 text-sm">
                    {property.beds} bd / {property.baths} ba
                  </td>
                ))}
              </tr>

              <tr className="border-b bg-muted/30">
                <td className="py-3 px-2 text-sm font-medium">Sqft</td>
                {properties.map((property) => (
                  <td key={property.id} className="py-3 px-2">
                    <div className="text-sm font-semibold">
                      {property.sqft ? property.sqft.toLocaleString() : '—'} sqft
                    </div>
                    {property.sqft && avgSqft && property.sqft > avgSqft && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Larger
                      </Badge>
                    )}
                  </td>
                ))}
              </tr>

              <tr className="border-b">
                <td className="py-3 px-2 text-sm font-medium">Price/Sqft</td>
                {properties.map((property) => (
                  <td key={property.id} className="py-3 px-2">
                    <div className="text-sm font-semibold">
                      ${pricePerSqft(property)}
                    </div>
                    {(property.price / property.sqft) < avgPricePerSqft && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        Better Value
                      </Badge>
                    )}
                  </td>
                ))}
              </tr>

              {properties.some(p => p.roi_percent) && (
                <tr className="border-b bg-muted/30">
                  <td className="py-3 px-2 text-sm font-medium">Est. ROI</td>
                  {properties.map((property) => (
                    <td key={property.id} className="py-3 px-2">
                      {property.roi_percent ? (
                        <div className="text-sm font-bold text-secondary">
                          {property.roi_percent}%
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {properties.some(p => p.arv) && (
                <tr className="border-b">
                  <td className="py-3 px-2 text-sm font-medium">ARV</td>
                  {properties.map((property) => (
                    <td key={property.id} className="py-3 px-2 text-sm">
                      {property.arv ? formatPrice(property.arv) : 'N/A'}
                    </td>
                  ))}
                </tr>
              )}

              <tr className="border-b bg-muted/30">
                <td className="py-3 px-2 text-sm font-medium">Condition</td>
                {properties.map((property) => (
                  <td key={property.id} className="py-3 px-2">
                    <Badge variant="outline">{property.condition || 'N/A'}</Badge>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Comparison Summary
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Avg Price:</span>
              <div className="font-semibold">{formatPrice(avgPrice)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Sqft:</span>
              <div className="font-semibold">{avgSqft ? Math.round(avgSqft).toLocaleString() : '—'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Price/Sqft:</span>
              <div className="font-semibold">${avgPricePerSqft.toFixed(0)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
