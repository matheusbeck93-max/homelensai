// Mortgage calculation utilities

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

export interface MortgageCalculation {
  loanAmount: number;
  monthlyPI: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyHOA: number;
  monthlyPMI: number;
  totalMonthly: number;
  pointsCost: number;
  downPayment: number;
  totalCashNeeded: number;
}

export const calculateMortgage = (
  price: number,
  downPct: number,
  ratePct: number,
  years: number,
  taxPct: number,
  insuranceAnnual: number,
  hoaMonthly: number,
  pmiPct: number,
  pointsPct: number,
  closingCosts: number
): MortgageCalculation => {
  const downPayment = price * (downPct / 100);
  const loanAmount = price - downPayment;
  const monthlyRate = ratePct / 100 / 12;
  const numPayments = years * 12;

  // Calculate monthly P&I using standard mortgage formula
  let monthlyPI = 0;
  if (monthlyRate > 0) {
    monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  } else {
    monthlyPI = loanAmount / numPayments;
  }

  const monthlyTax = (price * (taxPct / 100)) / 12;
  const monthlyInsurance = insuranceAnnual / 12;
  const monthlyPMI = downPct < 20 ? (loanAmount * (pmiPct / 100)) / 12 : 0;
  const pointsCost = loanAmount * (pointsPct / 100);
  const totalCashNeeded = downPayment + pointsCost + closingCosts;

  const totalMonthly = monthlyPI + monthlyTax + monthlyInsurance + hoaMonthly + monthlyPMI;

  return {
    loanAmount,
    monthlyPI,
    monthlyTax,
    monthlyInsurance,
    monthlyHOA: hoaMonthly,
    monthlyPMI,
    totalMonthly,
    pointsCost,
    downPayment,
    totalCashNeeded,
  };
};

export interface InvestorCalculation {
  loanAmount: number;
  monthlyMortgage: number;
  effectiveRent: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyRepairs: number;
  monthlyCapex: number;
  monthlyManagement: number;
  monthlyHOA: number;
  totalMonthlyExpenses: number;
  monthlyCashFlow: number;
  annualNOI: number;
  capRate: number;
  cashOnCash: number;
  dscr: number;
  breakEvenRent: number;
}

export const calculateInvestorMetrics = (
  price: number,
  downPct: number,
  ratePct: number,
  years: number,
  rentMonthly: number,
  vacancyPct: number,
  taxPct: number,
  insuranceAnnual: number,
  repairsPct: number,
  capexPct: number,
  managementPct: number,
  hoaMonthly: number,
  closingCosts: number
): InvestorCalculation => {
  const downPayment = price * (downPct / 100);
  const loanAmount = price - downPayment;
  const monthlyRate = ratePct / 100 / 12;
  const numPayments = years * 12;

  // Monthly mortgage P&I
  let monthlyMortgage = 0;
  if (monthlyRate > 0) {
    monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  } else {
    monthlyMortgage = loanAmount / numPayments;
  }

  // Effective rent after vacancy
  const effectiveRent = rentMonthly * (1 - vacancyPct / 100);

  // Operating expenses
  const monthlyTax = (price * (taxPct / 100)) / 12;
  const monthlyInsurance = insuranceAnnual / 12;
  const monthlyRepairs = effectiveRent * (repairsPct / 100);
  const monthlyCapex = effectiveRent * (capexPct / 100);
  const monthlyManagement = effectiveRent * (managementPct / 100);

  const totalMonthlyExpenses = monthlyMortgage + monthlyTax + monthlyInsurance +
    monthlyRepairs + monthlyCapex + monthlyManagement + hoaMonthly;

  const monthlyCashFlow = effectiveRent - totalMonthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;

  // NOI (without mortgage)
  const annualOperatingExpenses = (monthlyTax + monthlyInsurance + monthlyRepairs +
    monthlyCapex + monthlyManagement + hoaMonthly) * 12;
  const annualNOI = (effectiveRent * 12) - annualOperatingExpenses;

  // Cap Rate
  const capRate = (annualNOI / price) * 100;

  // Cash on Cash Return
  const totalCashInvested = downPayment + closingCosts;
  const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

  // DSCR (Debt Service Coverage Ratio)
  const annualDebtService = monthlyMortgage * 12;
  const dscr = annualDebtService > 0 ? annualNOI / annualDebtService : 0;

  // Break-even rent (monthly rent needed for $0 cash flow)
  const breakEvenRent = totalMonthlyExpenses / (1 - vacancyPct / 100);

  return {
    loanAmount,
    monthlyMortgage,
    effectiveRent,
    monthlyTax,
    monthlyInsurance,
    monthlyRepairs,
    monthlyCapex,
    monthlyManagement,
    monthlyHOA: hoaMonthly,
    totalMonthlyExpenses,
    monthlyCashFlow,
    annualNOI,
    capRate,
    cashOnCash,
    dscr,
    breakEvenRent,
  };
};

export interface BuyingPowerCalculation {
  disposableIncome: number;
  buyingPowerScore: number;
  conservativeSpending: number;
  standardSpending: number;
  aggressiveSpending: number;
}

export const calculateBuyingPower = (
  incomeMonthly: number,
  debtsMonthly: number,
  expensesMonthly: number,
  savings: number,
  creditScore: number,
  investmentMonthly: number
): BuyingPowerCalculation => {
  const disposableIncome = incomeMonthly - debtsMonthly - expensesMonthly - investmentMonthly;

  // Buying Power Score (0-100) based on:
  // - Disposable income (40%)
  // - Savings (30%)
  // - Credit score (30%)
  const incomeScore = Math.min((disposableIncome / 5000) * 40, 40);
  const savingsScore = Math.min((savings / 50000) * 30, 30);
  const creditScoreNormalized = Math.min(((creditScore - 300) / 550) * 30, 30);
  
  const buyingPowerScore = Math.max(0, Math.min(100, incomeScore + savingsScore + creditScoreNormalized));

  // Spending capacity based on different risk levels
  const conservativeSpending = disposableIncome * 0.10;
  const standardSpending = disposableIncome * 0.20;
  const aggressiveSpending = disposableIncome * 0.30;

  return {
    disposableIncome,
    buyingPowerScore,
    conservativeSpending,
    standardSpending,
    aggressiveSpending,
  };
};
