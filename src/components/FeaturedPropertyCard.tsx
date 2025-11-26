// This component is deprecated. Use PropertyCard from @/components/property/PropertyCard instead.
import { PropertyCard } from "@/components/property/PropertyCard";
import { HomeLensListing } from "@/types/ui-blocks";

interface FeaturedPropertyCardProps {
  property: HomeLensListing;
  onAnalyze?: (property: HomeLensListing) => void;
}

export function FeaturedPropertyCard({ property, onAnalyze }: FeaturedPropertyCardProps) {
  return <PropertyCard property={property} onAnalyze={onAnalyze} />;
}
