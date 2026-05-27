/**
 * Pure compute for the "Your budget vs market" insight.
 *
 * Inputs come straight from user preferences (`budget_max`, optional `budget_min`)
 * — no cash/down derivation. Outputs per-market affordability and headroom.
 */

export interface MarketStats {
  market: string;
  medianListPrice: number;
  totalListings: number;
  /** Optional list price distribution for finer affordability counts. */
  pricedListings?: number[];
}

export interface BudgetAffordabilityInput {
  budgetMax: number;
  budgetMin?: number;
  markets: MarketStats[];
}

export interface BudgetAffordabilityMarketRow {
  market: string;
  medianListPrice: number;
  totalListings: number;
  listingsAffordable: number;
  affordabilityPct: number;
  headroomPct: number;
}

export interface BudgetAffordabilityResult {
  budgetMax: number;
  budgetMin?: number;
  perMarket: BudgetAffordabilityMarketRow[];
}

function defaultAffordabilityCurve(price: number, median: number, total: number): number {
  if (median <= 0 || total <= 0) return 0;
  const ratio = price / median;
  const k = 3.5;
  const frac = 1 / (1 + Math.exp(-k * (ratio - 1)));
  return Math.round(frac * total);
}

export function computeBudgetAffordability(
  input: BudgetAffordabilityInput,
): BudgetAffordabilityResult {
  const { budgetMax, budgetMin } = input;

  const perMarket: BudgetAffordabilityMarketRow[] = input.markets.map((m) => {
    let listingsAffordable: number;
    if (m.pricedListings && m.pricedListings.length > 0) {
      listingsAffordable = m.pricedListings.filter(
        (p) => p <= budgetMax && (budgetMin == null || p >= budgetMin),
      ).length;
    } else {
      const maxCount = defaultAffordabilityCurve(budgetMax, m.medianListPrice, m.totalListings);
      const minCount =
        budgetMin != null
          ? defaultAffordabilityCurve(budgetMin, m.medianListPrice, m.totalListings)
          : 0;
      listingsAffordable = Math.max(0, maxCount - minCount);
    }
    const affordabilityPct =
      m.totalListings > 0 ? listingsAffordable / m.totalListings : 0;
    const headroomPct =
      m.medianListPrice > 0 ? (budgetMax - m.medianListPrice) / m.medianListPrice : 0;
    return {
      market: m.market,
      medianListPrice: m.medianListPrice,
      totalListings: m.totalListings,
      listingsAffordable,
      affordabilityPct,
      headroomPct,
    };
  });

  return { budgetMax, budgetMin, perMarket };
}