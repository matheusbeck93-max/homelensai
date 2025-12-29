import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, SlidersHorizontal } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";

export interface PropertyFiltersState {
  priceMin: number;
  priceMax: number;
  bedsMin: number | null;
  bathsMin: number | null;
  propertyTypes: string[];
}

interface PropertyFiltersProps {
  filters: PropertyFiltersState;
  onFiltersChange: (filters: PropertyFiltersState) => void;
  onClear: () => void;
  className?: string;
}

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "land", label: "Land" },
];

const BEDS_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
  { value: "5", label: "5+" },
];

const BATHS_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];

export const PropertyFilters: React.FC<PropertyFiltersProps> = ({
  filters,
  onFiltersChange,
  onClear,
  className = "",
}) => {
  const handlePriceChange = (values: number[]) => {
    onFiltersChange({
      ...filters,
      priceMin: values[0],
      priceMax: values[1],
    });
  };

  const handleBedsChange = (value: string) => {
    onFiltersChange({
      ...filters,
      bedsMin: value === "any" ? null : parseInt(value, 10),
    });
  };

  const handleBathsChange = (value: string) => {
    onFiltersChange({
      ...filters,
      bathsMin: value === "any" ? null : parseInt(value, 10),
    });
  };

  const handlePropertyTypeToggle = (type: string, checked: boolean) => {
    const newTypes = checked
      ? [...filters.propertyTypes, type]
      : filters.propertyTypes.filter((t) => t !== type);
    onFiltersChange({
      ...filters,
      propertyTypes: newTypes,
    });
  };

  const hasActiveFilters =
    filters.priceMin > 0 ||
    filters.priceMax < 2000000 ||
    filters.bedsMin !== null ||
    filters.bathsMin !== null ||
    filters.propertyTypes.length > 0;

  return (
    <div className={`bg-card border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Filters</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-8 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      <div className="space-y-5">
        {/* Price Range Slider */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Price Range</Label>
          <Slider
            value={[filters.priceMin, filters.priceMax]}
            onValueChange={handlePriceChange}
            min={0}
            max={2000000}
            step={25000}
            className="mt-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(filters.priceMin)}</span>
            <span>{filters.priceMax >= 2000000 ? "$2M+" : formatCurrency(filters.priceMax)}</span>
          </div>
        </div>

        {/* Beds & Baths Dropdowns */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Bedrooms</Label>
            <Select
              value={filters.bedsMin?.toString() || "any"}
              onValueChange={handleBedsChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-md z-50">
                {BEDS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Bathrooms</Label>
            <Select
              value={filters.bathsMin?.toString() || "any"}
              onValueChange={handleBathsChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-md z-50">
                {BATHS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Property Type Checkboxes */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Property Type</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {PROPERTY_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`prop-type-${type.value}`}
                  checked={filters.propertyTypes.includes(type.value)}
                  onCheckedChange={(checked) =>
                    handlePropertyTypeToggle(type.value, checked as boolean)
                  }
                />
                <label
                  htmlFor={`prop-type-${type.value}`}
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {type.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
