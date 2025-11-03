/**
 * Property Scoring System
 * Generates 4 key scores (0-100) for investment analysis
 */

export interface PropertyScores {
  equityGrowth: number;
  neighborhoodMomentum: number;
  liquidityRisk: number;
  rentability: number;
}

export interface PropertyData {
  price: number;
  sqft: number;
  beds: number;
  baths: number;
  yearBuilt?: number;
  taxes: number;
  hoa?: number;
  daysOnMarket?: number;
  arv?: number;
  estimatedRent?: number;
}

/**
 * Equity Growth Score (0-100)
 * Based on: Price/sqft ratio, ARV potential, tax burden
 */
export function calculateEquityGrowthScore(property: PropertyData): number {
  let score = 50; // Start at neutral

  // Price per sqft analysis (lower is better for growth potential)
  const pricePerSqft = property.price / property.sqft;
  if (pricePerSqft < 150) score += 15;
  else if (pricePerSqft < 200) score += 10;
  else if (pricePerSqft < 250) score += 5;
  else if (pricePerSqft > 400) score -= 15;
  else if (pricePerSqft > 350) score -= 10;

  // ARV potential (if available)
  if (property.arv) {
    const potentialGain = ((property.arv - property.price) / property.price) * 100;
    if (potentialGain > 25) score += 20;
    else if (potentialGain > 15) score += 15;
    else if (potentialGain > 10) score += 10;
    else if (potentialGain < 5) score -= 10;
  }

  // Property age factor (newer = better equity retention)
  if (property.yearBuilt) {
    const age = new Date().getFullYear() - property.yearBuilt;
    if (age < 5) score += 10;
    else if (age < 15) score += 5;
    else if (age > 40) score -= 5;
    else if (age > 60) score -= 10;
  }

  // Tax burden (lower is better)
  const taxRate = (property.taxes / property.price) * 100;
  if (taxRate < 0.8) score += 10;
  else if (taxRate < 1.2) score += 5;
  else if (taxRate > 2.0) score -= 10;
  else if (taxRate > 2.5) score -= 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * Neighborhood Momentum Score (0-100)
 * Based on: Days on market, price trends, demand indicators
 */
export function calculateNeighborhoodMomentumScore(property: PropertyData): number {
  let score = 50; // Start at neutral

  // Days on market (lower = higher demand)
  if (property.daysOnMarket !== undefined) {
    if (property.daysOnMarket < 7) score += 25;
    else if (property.daysOnMarket < 14) score += 20;
    else if (property.daysOnMarket < 30) score += 15;
    else if (property.daysOnMarket < 60) score += 5;
    else if (property.daysOnMarket > 120) score -= 15;
    else if (property.daysOnMarket > 180) score -= 25;
  }

  // Competitive pricing (price/sqft vs market avg ~$225)
  const pricePerSqft = property.price / property.sqft;
  const marketAvg = 225;
  const deviation = Math.abs(pricePerSqft - marketAvg) / marketAvg * 100;
  
  if (deviation < 10) score += 15; // Priced right
  else if (deviation < 20) score += 10;
  else if (deviation > 40) score -= 10;

  // Property size appeal (beds/baths balance)
  if (property.beds >= 3 && property.baths >= 2) score += 10;
  if (property.beds >= 4 && property.baths >= 2.5) score += 5;
  if (property.beds < 2 || property.baths < 1.5) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Liquidity Risk Score (0-100)
 * Lower score = higher risk, based on: property characteristics, market factors
 */
export function calculateLiquidityRiskScore(property: PropertyData): number {
  let score = 70; // Start optimistic

  // HOA impact (high HOA reduces liquidity)
  if (property.hoa) {
    if (property.hoa > 400) score -= 20;
    else if (property.hoa > 300) score -= 15;
    else if (property.hoa > 200) score -= 10;
    else if (property.hoa > 100) score -= 5;
  } else {
    score += 5; // No HOA is a plus
  }

  // Price point (extreme prices = lower liquidity)
  if (property.price < 150000) score -= 15; // Too cheap, may have issues
  else if (property.price < 250000) score += 10; // Sweet spot
  else if (property.price < 500000) score += 15; // Good liquidity range
  else if (property.price < 750000) score += 5;
  else if (property.price > 1000000) score -= 15; // Luxury = smaller buyer pool
  else if (property.price > 1500000) score -= 25;

  // Bedroom count (3-4 beds = most liquid)
  if (property.beds === 3 || property.beds === 4) score += 10;
  else if (property.beds < 2) score -= 15;
  else if (property.beds > 5) score -= 10;

  // Property age
  if (property.yearBuilt) {
    const age = new Date().getFullYear() - property.yearBuilt;
    if (age < 10) score += 10;
    else if (age > 50) score -= 10;
    else if (age > 70) score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Rentability Score (0-100)
 * Based on: 1% rule, cash flow potential, investor appeal
 */
export function calculateRentabilityScore(property: PropertyData): number {
  let score = 50; // Start neutral

  // Calculate estimated rent using 1% rule
  const estimatedMonthlyRent = property.estimatedRent || (property.price * 0.01);
  
  // 1% rule compliance
  const rentToPrice = (estimatedMonthlyRent / property.price) * 100;
  if (rentToPrice >= 1.2) score += 25; // Excellent
  else if (rentToPrice >= 1.0) score += 20; // Good
  else if (rentToPrice >= 0.8) score += 10; // Decent
  else if (rentToPrice < 0.6) score -= 15; // Poor
  else if (rentToPrice < 0.5) score -= 25; // Very poor

  // Bedroom count (3-4 beds = best rental demand)
  if (property.beds === 3 || property.beds === 4) score += 15;
  else if (property.beds === 2) score += 10;
  else if (property.beds === 5) score += 5;
  else if (property.beds === 1) score -= 10;
  else if (property.beds > 5) score -= 15;

  // HOA impact on cash flow
  if (property.hoa) {
    if (property.hoa < 100) score += 5;
    else if (property.hoa > 250) score -= 10;
    else if (property.hoa > 400) score -= 20;
  } else {
    score += 10; // No HOA is excellent for rental cash flow
  }

  // Tax burden
  const monthlyTaxes = property.taxes / 12;
  const taxToPriceRatio = (property.taxes / property.price) * 100;
  if (taxToPriceRatio < 1.0) score += 10;
  else if (taxToPriceRatio > 2.0) score -= 10;

  // Price point (mid-range = best rental demand)
  if (property.price >= 200000 && property.price <= 450000) score += 10;
  else if (property.price > 700000) score -= 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate all scores for a property
 */
export function calculatePropertyScores(property: PropertyData): PropertyScores {
  return {
    equityGrowth: calculateEquityGrowthScore(property),
    neighborhoodMomentum: calculateNeighborhoodMomentumScore(property),
    liquidityRisk: calculateLiquidityRiskScore(property),
    rentability: calculateRentabilityScore(property),
  };
}

/**
 * Get color and label for score
 */
export function getScoreColor(score: number): { color: string; label: string; badge: string } {
  if (score >= 80) return { color: "text-green-600", label: "Excellent", badge: "default" };
  if (score >= 65) return { color: "text-emerald-600", label: "Good", badge: "secondary" };
  if (score >= 50) return { color: "text-yellow-600", label: "Fair", badge: "outline" };
  if (score >= 35) return { color: "text-orange-600", label: "Below Average", badge: "outline" };
  return { color: "text-red-600", label: "Poor", badge: "destructive" };
}

/**
 * Get score description and tooltip
 */
export function getScoreDescription(scoreType: keyof PropertyScores): string {
  const descriptions = {
    equityGrowth: "Measures long-term appreciation potential based on price/sqft, ARV, property age, and tax burden. Higher scores indicate better equity building opportunity.",
    neighborhoodMomentum: "Evaluates market demand and neighborhood strength using days on market, pricing competitiveness, and property appeal. High scores suggest hot markets.",
    liquidityRisk: "Assesses how easily you can sell this property. Based on price point, HOA fees, bedroom count, and property age. Higher scores mean easier to sell.",
    rentability: "Analyzes rental income potential using the 1% rule, bedroom count, and operating costs. Higher scores indicate better cash flow for investors.",
  };
  return descriptions[scoreType];
}
