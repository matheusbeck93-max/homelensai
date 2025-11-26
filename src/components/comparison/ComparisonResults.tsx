import { DetailedComparisonView } from "./DetailedComparisonView";
import { HomeLensListing } from "@/types/ui-blocks";

interface ComparisonResultsProps {
  properties: HomeLensListing[];
  onClose: () => void;
  onRemove: (propertyId: string) => void;
}

export function ComparisonResults({ properties, onClose, onRemove }: ComparisonResultsProps) {
  return (
    <DetailedComparisonView 
      properties={properties} 
      onClose={onClose} 
      onRemove={onRemove}
    />
  );
}
