import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useFavorites } from "@/contexts/FavoritesContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Bed, Bath, Maximize, ExternalLink, Search } from "lucide-react";
import { ShareMenu } from "@/components/ShareMenu";
import { OptimizedImage } from "@/components/OptimizedImage";

export function FavoritesPanel() {
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useFavorites();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "price-low" | "price-high">("recent");
  const [filterBeds, setFilterBeds] = useState<string>("all");

  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const filteredAndSortedFavorites = useMemo(() => {
    let filtered = [...favorites];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.state?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by beds
    if (filterBeds !== "all") {
      const beds = parseInt(filterBeds);
      filtered = filtered.filter((p) => p.beds && p.beds >= beds);
    }

    // Sort
    if (sortBy === "price-low") {
      filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === "price-high") {
      filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    return filtered;
  }, [favorites, searchTerm, sortBy, filterBeds]);

  if (favorites.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">No favorite homes yet</h2>
        <p className="text-muted-foreground mb-4">
          Tap the heart icon on a property to save it here
        </p>
        <Button onClick={() => navigate("/")}>Browse Properties</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="price-low">Price: Low to High</SelectItem>
            <SelectItem value="price-high">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterBeds} onValueChange={setFilterBeds}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by beds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bedrooms</SelectItem>
            <SelectItem value="1">1+ Beds</SelectItem>
            <SelectItem value="2">2+ Beds</SelectItem>
            <SelectItem value="3">3+ Beds</SelectItem>
            <SelectItem value="4">4+ Beds</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredAndSortedFavorites.length} of {favorites.length} favorites
        </p>
      </div>

      {/* Properties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedFavorites.map((property) => (
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
                {property.sqft ? (
                  <span className="flex items-center gap-1">
                    <Maximize className="h-4 w-4" />
                    {typeof property.sqft === 'number' ? property.sqft.toLocaleString() : property.sqft} sqft
                  </span>
                ) : null}
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

      {filteredAndSortedFavorites.length === 0 && searchTerm && (
        <Card className="p-8 text-center">
          <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No favorites match your search</p>
        </Card>
      )}
    </div>
  );
}
