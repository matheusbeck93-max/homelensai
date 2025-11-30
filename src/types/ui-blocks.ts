export interface HomeLensListing {
  id: string;
  address: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photoUrl: string | null;
  listingUrl: string | null;
  status: string | null;
  source: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  
  // Valuations
  zestimate?: number | null;
  rentZestimate?: number | null;
  pricePerSqft?: number | null;
  
  // Price fairness
  fairPriceScore?: number | null;
  fairPriceLevel?: 'very_underpriced' | 'underpriced' | 'fair' | 'overpriced' | 'very_overpriced' | null;
  
  insights?: {
    rentcast?: {
      rent_estimate?: number | null;
      rent_low?: number | null;
      rent_high?: number | null;
      value_estimate?: number | null;
      confidence?: string | null;
      zip_market_summary?: {
        median_rent?: number | null;
        median_home_value?: number | null;
        rent_to_price_ratio?: number | null;
        trend_label?: string | null;
      } | null;
    };
    census?: {
      median_household_income?: number | null;
      owner_occupied_rate?: number | null;
      renter_occupied_rate?: number | null;
      median_age?: number | null;
      average_household_size?: number | null;
    };
  };
}

export type PropertyResultsCarouselBlock = {
  type: "ui_block/property_results_carousel" | "ui_block/property_results_grid";
  title: string;
  properties: HomeLensListing[];
  meta?: {
    locationLabel?: string;
    totalResults?: number;
  };
};

export type MortgageCalculatorBlock = {
  type: "ui_block/mortgage_calculator";
  title: string;
  inputs: {
    price: number;
    downPct: number;
    ratePct: number;
    years: number;
    taxPct: number;
    insuranceAnnual: number;
    hoaMonthly: number;
    pmiPct: number;
    pointsPct: number;
    closingCosts: number;
  };
};

export type InvestorCalculatorBlock = {
  type: "ui_block/homelens_investor";
  title: string;
  inputs: {
    price: number;
    downPct: number;
    ratePct: number;
    years: number;
    rentMonthly: number;
    vacancyPct: number;
    taxPct: number;
    insuranceAnnual: number;
    repairsPct: number;
    capexPct: number;
    managementPct: number;
    hoaMonthly: number;
    closingCosts: number;
  };
  rentEstimate?: {
    amount: number;
    source: 'rentcast' | 'user';
  };
};

export type BuyingPowerBlock = {
  type: "ui_block/individual_buying_power";
  title: string;
  inputs: {
    incomeMonthly: number;
    debtsMonthly: number;
    expensesMonthly: number;
    savings: number;
    creditScore: number;
    riskTolerance: string;
    investmentMonthly: number;
  };
  scenarios: {
    id: string;
    label: string;
    spendingMultiplier: number;
  }[];
};

export type UIBlock =
  | PropertyResultsCarouselBlock
  | MortgageCalculatorBlock
  | InvestorCalculatorBlock
  | BuyingPowerBlock;
