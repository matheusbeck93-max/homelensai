import React, { createContext, useContext, useState, useEffect } from 'react';
import { HomeLensListing } from '@/types/ui-blocks';

interface ComparisonContextType {
  selectedProperties: HomeLensListing[];
  addToComparison: (property: HomeLensListing) => void;
  removeFromComparison: (propertyId: string) => void;
  clearComparison: () => void;
  isSelected: (propertyId: string) => boolean;
  canAddMore: boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

const MAX_COMPARISON_ITEMS = 4;

export function ComparisonProvider({ children }: { children: React.ReactNode }) {
  const [selectedProperties, setSelectedProperties] = useState<HomeLensListing[]>([]);

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
    if (selectedProperties.length >= MAX_COMPARISON_ITEMS) {
      return;
    }
    if (!selectedProperties.find(p => p.id === property.id)) {
      setSelectedProperties(prev => [...prev, property]);
    }
  };

  const removeFromComparison = (propertyId: string) => {
    setSelectedProperties(prev => prev.filter(p => p.id !== propertyId));
  };

  const clearComparison = () => {
    setSelectedProperties([]);
  };

  const isSelected = (propertyId: string) => {
    return selectedProperties.some(p => p.id === propertyId);
  };

  const canAddMore = selectedProperties.length < MAX_COMPARISON_ITEMS;

  return (
    <ComparisonContext.Provider
      value={{
        selectedProperties,
        addToComparison,
        removeFromComparison,
        clearComparison,
        isSelected,
        canAddMore,
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
