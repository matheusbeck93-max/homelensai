/**
 * Pure compute for the Buying Power insight card.
 *
 *   buyingPower      = cash_available / downPct
 *   listingsAffordable = count(activeListings ≤ buyingPower)
 *   affordabilityPct = listingsAffordable / totalListings
 *   headroomPct      = (buyingPower - medianListPrice) / medianListPrice
 */

export interface MarketStats {
  market: string;
  medianListPrice: number;
  totalListings: number;
  /** Optional bucketed list price distribution for finer affordability counts. */
  pricedListings?: number[];
}

export interface BuyingPowerInput {
  cashAvailable: number;
  downPct: number; // percentage 0-100
  rateApr: number;
  termYears: number;
  markets: MarketStats[];
}

export interface BuyingPowerMarketRow {
  market: string;
  medianListPrice: number;
  totalListings: number;
  listingsAffordable: number;
  affordabilityPct: number;
  headroomPct: number;
}

export interface BuyingPowerResult {
  buyingPower: number;
  cashAvailable: number;
  downPct: number;
  rateApr: number;
  termYears: number;
  perMarket: BuyingPowerMarketRow[];
}

export function computeBuyingPower(input: BuyingPowerInput): BuyingPowerResult {
  const downFraction = Math.max(0.01, input.downPct / 100);
  const buyingPower = input.cashAvailable / downFraction;

  const perMarket: BuyingPowerMarketRow[] = input.markets.map((m) => {
    let listingsAffordable: number;
    if (m.pricedListings && m.pricedListings.length > 0) {
      listingsAffordable = m.pricedListings.filter((p) => p <= buyingPower).length;
    } else {
      // Approximate from median: assume rough log-normal — buyingPower
      // covers ~50% at median, scaled by headroom.
      const headroom = (buyingPower - m.medianListPrice) / m.medianListPrice;
      const approxPct = Math.max(0.05, Math.min(0.97, 0.5 + headroom * 0.6));
      listingsAffordable = Math.round(approxPct * m.totalListings);
    }
    const affordabilityPct =
      m.totalListings > 0 ? listingsAffordable / m.totalListings : 0;
    const headroomPct =
      m.medianListPrice > 0
        ? (buyingPower - m.medianListPrice) / m.medianListPrice
        : 0;
    return {
      market: m.market,
      medianListPrice: m.medianListPrice,
      totalListings: m.totalListings,
      listingsAffordable,
      affordabilityPct,
      headroomPct,
    };
  });

  return {
    buyingPower,
    cashAvailable: input.cashAvailable,
    downPct: input.downPct,
    rateApr: input.rateApr,
    termYears: input.termYears,
    perMarket,
  };
}