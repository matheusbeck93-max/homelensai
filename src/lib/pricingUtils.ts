export type FairnessLevel = 
  | 'very_underpriced' 
  | 'underpriced' 
  | 'fair' 
  | 'overpriced' 
  | 'very_overpriced';

export interface PriceFairnessResult {
  level: FairnessLevel;
  percentageDiff: number;
  medianPrice: number;
  medianPricePerSqft: number;
  propertyPricePerSqft: number;
}

interface PropertyForAnalysis {
  price: number;
  sqft: number;
}

/**
 * Calculate price fairness for a property compared to similar properties in the result set
 */
export function calculatePriceFairness(
  property: PropertyForAnalysis,
  allProperties: PropertyForAnalysis[]
): PriceFairnessResult | null {
  if (!property.sqft || property.sqft <= 0) {
    return null;
  }

  // Filter valid properties with sqft data
  const validProperties = allProperties.filter(p => p.sqft > 0);
  
  if (validProperties.length < 2) {
    return null; // Need at least 2 properties for comparison
  }

  // Calculate price per sqft for all properties
  const pricesPerSqft = validProperties.map(p => p.price / p.sqft);
  const prices = validProperties.map(p => p.price);

  // Calculate medians
  const medianPrice = calculateMedian(prices);
  const medianPricePerSqft = calculateMedian(pricesPerSqft);
  
  const propertyPricePerSqft = property.price / property.sqft;
  
  // Calculate percentage difference from median
  const diffFromMedianPrice = ((property.price - medianPrice) / medianPrice) * 100;
  const diffFromMedianPricePerSqft = ((propertyPricePerSqft - medianPricePerSqft) / medianPricePerSqft) * 100;
  
  // Use the average of both differences for a balanced assessment
  const percentageDiff = (diffFromMedianPrice + diffFromMedianPricePerSqft) / 2;

  // Determine fairness level based on percentage difference
  let level: FairnessLevel;
  if (percentageDiff <= -12) {
    level = 'very_underpriced';
  } else if (percentageDiff <= -5) {
    level = 'underpriced';
  } else if (percentageDiff <= 5) {
    level = 'fair';
  } else if (percentageDiff <= 12) {
    level = 'overpriced';
  } else {
    level = 'very_overpriced';
  }

  return {
    level,
    percentageDiff: Math.round(percentageDiff * 10) / 10, // Round to 1 decimal
    medianPrice,
    medianPricePerSqft,
    propertyPricePerSqft
  };
}

/**
 * Calculate median of an array of numbers
 */
function calculateMedian(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

/**
 * Get a human-readable label for fairness level
 */
export function getFairnessLabel(level: FairnessLevel): string {
  const labels: Record<FairnessLevel, string> = {
    very_underpriced: 'Great Value',
    underpriced: 'Good Deal',
    fair: 'Fairly Priced',
    overpriced: 'Above Market',
    very_overpriced: 'High Premium'
  };
  return labels[level];
}

/**
 * Get description text for fairness analysis
 */
export function getFairnessDescription(result: PriceFairnessResult): string {
  const absPercentage = Math.abs(result.percentageDiff);
  const direction = result.percentageDiff < 0 ? 'below' : 'above';
  
  if (result.level === 'fair') {
    return 'Priced in line with similar homes';
  }
  
  return `~${absPercentage.toFixed(1)}% ${direction} local median`;
}

/**
 * Get color class for fairness level (Tailwind-compatible)
 */
export function getFairnessColor(level: FairnessLevel): {
  bg: string;
  text: string;
  border: string;
} {
  const colors: Record<FairnessLevel, { bg: string; text: string; border: string }> = {
    very_underpriced: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-500/20'
    },
    underpriced: {
      bg: 'bg-green-500/10',
      text: 'text-green-700 dark:text-green-400',
      border: 'border-green-500/20'
    },
    fair: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-500/20'
    },
    overpriced: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-700 dark:text-orange-400',
      border: 'border-orange-500/20'
    },
    very_overpriced: {
      bg: 'bg-red-500/10',
      text: 'text-red-700 dark:text-red-400',
      border: 'border-red-500/20'
    }
  };
  return colors[level];
}
