export interface InvestorInputs {
  // Purchase & Financing
  price: number;
  downPct: number;
  ratePct: number;
  years: number;
  loanType: 'fixed' | 'arm';
  armPeriod: '5/1' | '7/1' | '10/1';
  armRateCap: number;
  armExpectedRate: number;

  // Rental Income
  rentMonthly: number;
  vacancyPct: number;
  rentGrowthPct: number;

  // Operating Expenses
  taxPct: number;
  insuranceAnnual: number;
  repairsPct: number;
  capexPct: number;
  managementPct: number;
  selfManaged: boolean;
  hoaMonthly: number;
  expenseGrowthPct: number;

  // Acquisition Costs
  closingCostsMode: 'percent' | 'dollar';
  closingCostsPct: number;
  closingCostsDollar: number;
  state: string;

  // Exit Strategy
  sellingCostsPct: number;
  holdingPeriod: number;
  investorProfile: 'primary' | 'investment';
  marginalTaxRate: number;
  appreciationPct: number;
  filingStatus: 'single' | 'mfj';
}

export interface ComputedResults {
  // Loan
  loanAmount: number;
  downPayment: number;
  closingCosts: number;
  totalCashInvested: number;
  monthlyMortgage: number;
  monthlyPMI: number;

  // Income
  effectiveRent: number;

  // Expenses
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyRepairs: number;
  monthlyCapex: number;
  monthlyManagement: number;
  monthlyHOA: number;
  totalMonthlyExpenses: number;

  // Cash Flow
  monthlyCashFlow: number;
  annualNOI: number;

  // Metrics
  capRate: number;
  cashOnCash: number;
  grm: number;
  dscr: number;
  breakEvenOccupancy: number;
  breakEvenRent: number;

  // ARM scenario
  armMonthlyCashFlow?: number;
  armMonthlyMortgage?: number;

  // Projections
  projections: YearProjection[];
  irr: number;

  // Exit
  projectedSalePrice: number;
  sellingCosts: number;
  remainingLoanBalance: number;
  capitalGainsTax: number;
  federalCapitalGainsTax: number;
  stateCapitalGainsTax: number;
  stateCapitalGainsRate: number;
  netProceeds: number;
  totalReturn: number;
}

export interface YearProjection {
  year: number;
  propertyValue: number;
  equity: number;
  appreciationEquity: number;
  amortizationEquity: number;
  annualRent: number;
  annualNOI: number;
  annualCashFlow: number;
  cumulativeCashFlow: number;
  loanBalance: number;
}

export interface StressScenario {
  label: string;
  vacancyPct: number;
  rentGrowthPct: number;
  appreciationPct: number;
  monthlyCashFlow: number;
  cashOnCash: number;
}

export interface TaxDataResult {
  rate: number;
  source: string;
  updatedAt: string;
  fromCache: boolean;
}

export const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

export const FALLBACK_TAX_RATES: Record<string, number> = {
  AL: 0.41, AK: 1.04, AZ: 0.62, AR: 0.62, CA: 0.75, CO: 0.51, CT: 1.79, DE: 0.57, FL: 0.89, GA: 0.92,
  HI: 0.28, ID: 0.69, IL: 2.23, IN: 0.85, IA: 1.57, KS: 1.41, KY: 0.86, LA: 0.55, ME: 1.09, MD: 1.09,
  MA: 1.23, MI: 1.54, MN: 1.12, MS: 0.65, MO: 1.01, MT: 0.84, NE: 1.73, NV: 0.60, NH: 2.18, NJ: 2.49,
  NM: 0.80, NY: 1.72, NC: 0.84, ND: 0.98, OH: 1.62, OK: 0.90, OR: 0.97, PA: 1.58, RI: 1.53, SC: 0.57,
  SD: 1.31, TN: 0.71, TX: 1.80, UT: 0.57, VT: 1.90, VA: 0.82, WA: 0.98, WV: 0.59, WI: 1.85, WY: 0.61, DC: 0.56,
};

export const STATE_CAPITAL_GAINS_RATES: Record<string, number> = {
  AL: 5.0, AK: 0.0, AZ: 2.5, AR: 4.4, CA: 13.3, CO: 4.4, CT: 6.99, DE: 6.6, FL: 0.0, GA: 5.75,
  HI: 7.25, ID: 5.8, IL: 4.95, IN: 3.23, IA: 6.0, KS: 5.7, KY: 5.0, LA: 4.25, ME: 7.15, MD: 5.75,
  MA: 5.0, MI: 4.25, MN: 9.85, MS: 5.0, MO: 5.3, MT: 6.75, NE: 6.84, NV: 0.0, NH: 0.0, NJ: 10.75,
  NM: 5.9, NY: 10.9, NC: 4.75, ND: 2.9, OH: 3.99, OK: 4.75, OR: 9.9, PA: 3.07, RI: 5.99, SC: 6.5,
  SD: 0.0, TN: 0.0, TX: 0.0, UT: 4.85, VT: 8.75, VA: 5.75, WA: 7.0, WV: 6.5, WI: 7.65, WY: 0.0, DC: 10.75,
};

export const FLOOD_RISK_STATES = ['FL', 'TX', 'LA', 'SC', 'NC', 'NJ', 'NY', 'MS', 'AL', 'GA'];

export const DEFAULT_INPUTS: InvestorInputs = {
  price: 350000,
  downPct: 25,
  ratePct: 7.0,
  years: 30,
  loanType: 'fixed',
  armPeriod: '7/1',
  armRateCap: 2,
  armExpectedRate: 9.0,
  rentMonthly: 2200,
  vacancyPct: 8,
  rentGrowthPct: 3,
  taxPct: 1.0,
  insuranceAnnual: 1800,
  repairsPct: 5,
  capexPct: 7,
  managementPct: 10,
  selfManaged: false,
  hoaMonthly: 0,
  expenseGrowthPct: 2.5,
  closingCostsMode: 'percent',
  closingCostsPct: 3,
  closingCostsDollar: 0,
  state: '',
  sellingCostsPct: 6,
  holdingPeriod: 5,
  investorProfile: 'investment',
  marginalTaxRate: 20,
  appreciationPct: 3,
  filingStatus: 'single',
};
