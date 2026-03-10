import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Bed, Bath, Maximize, ExternalLink } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";
import { ShareMenu } from "@/components/ShareMenu";
import { OptimizedImage } from "@/components/OptimizedImage";

export default function Favorites() {
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useFavorites();

  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        <h1 className="text-3xl font-bold mb-8">My Favorites</h1>

        {favorites.length === 0 ? (
          <Card className="p-8 text-center">
            <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No favorite homes yet</h2>
            <p className="text-muted-foreground mb-4">
              Tap the heart icon on a property to save it here
            </p>
            <Button onClick={() => navigate("/")}>Browse Properties</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((property) => (
              <Card
                key={property.id}
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => navigate(`/property/${property.id}`)}
              >
                <div className="relative h-48 overflow-hidden">
                  <OptimizedImage
                    src={property.photoUrl || "/placeholder.svg"}
                    alt={property.address}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  <div className="absolute top-4 left-4 z-10">
                    <ShareMenu property={property}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="bg-background/80 backdrop-blur-sm hover:bg-background"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </ShareMenu>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleFavorite(property);
                    }}
                  >
                    <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                  </Button>
                </div>
                <div className="p-4">
                  <h3 className="text-xl font-bold text-primary mb-2">
                    {formatPrice(property.price)}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {property.address}
                    <br />
                    {property.city}, {property.state}
                  </p>
                  <div className="flex gap-4 text-sm text-muted-foreground mb-3">
                    {property.beds && (
                      <span className="flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        {property.beds}
                      </span>
                    )}
                    {property.baths && (
                      <span className="flex items-center gap-1">
                        <Bath className="h-4 w-4" />
                        {property.baths}
                      </span>
                    )}
                    {property.sqft && (
                      <span className="flex items-center gap-1">
                        <Maximize className="h-4 w-4" />
                        {property.sqft.toLocaleString()} sqft
                      </span>
                    )}
                  </div>
                  <Button 
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (property.listingUrl) {
                        window.open(property.listingUrl, "_blank");
                      }
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      
    </div>
  );
}
