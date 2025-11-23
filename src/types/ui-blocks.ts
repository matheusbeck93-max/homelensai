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
}

export type PropertyResultsCarouselBlock = {
  type: "ui_block/property_results_carousel";
  title: string;
  properties: HomeLensListing[];
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
