import React, { createContext, useContext, useState, useEffect } from 'react';
import { HomeLensListing } from '@/types/ui-blocks';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

interface ComparisonContextType {
  selectedProperties: HomeLensListing[];
  addToComparison: (property: HomeLensListing) => void;
  removeFromComparison: (propertyId: string) => void;
  clearComparison: () => void;
  isSelected: (propertyId: string) => boolean;
  isInComparison: (propertyId: string) => boolean;
  canAddMore: boolean;
  maxProperties: number;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export function ComparisonProvider({ children }: { children: React.ReactNode }) {
  const [selectedProperties, setSelectedProperties] = useState<HomeLensListing[]>([]);
  const { tier } = useSubscription();

  // Determine max based on subscription
  const maxProperties = tier === "free" ? 2 : 5;

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('homelens_comparison');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSelectedProperties(parsed);
      } catch (e) {
        console.error('Error loading comparison state:', e);
      }
    }
  }, []);

  // Save to localStorage whenever selection changes
  useEffect(() => {
    localStorage.setItem('homelens_comparison', JSON.stringify(selectedProperties));
  }, [selectedProperties]);

  const addToComparison = (property: HomeLensListing) => {
    if (selectedProperties.length >= maxProperties) {
      if (tier === "free") {
        toast.error("Free plan supports comparison of up to 2 properties. Upgrade to Pro to compare more homes.");
      } else {
        toast.error(`You can compare up to ${maxProperties} properties at a time.`);
      }
      return;
    }
    if (!selectedProperties.find(p => p.id === property.id)) {
      setSelectedProperties(prev => [...prev, property]);
      toast.success(`Added to comparison (${selectedProperties.length + 1}/${maxProperties})`);
    }
  };

  const removeFromComparison = (propertyId: string) => {
    setSelectedProperties(prev => prev.filter(p => p.id !== propertyId));
  };

  const clearComparison = () => {
    setSelectedProperties([]);
    toast.success("Comparison cleared");
  };

  const isSelected = (propertyId: string) => {
    return selectedProperties.some(p => p.id === propertyId);
  };

  const isInComparison = (propertyId: string) => {
    return selectedProperties.some(p => p.id === propertyId);
  };

  const canAddMore = selectedProperties.length < maxProperties;

  return (
    <ComparisonContext.Provider
      value={{
        selectedProperties,
        addToComparison,
        removeFromComparison,
        clearComparison,
        isSelected,
        isInComparison,
        canAddMore,
        maxProperties,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (context === undefined) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return context;
}