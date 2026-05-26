// Deno mirror of src/lib/investorChat/calcEngine.ts.
// Keep identical math. Update both files together.

export interface FinancingInput {
  downPct?: number;
  rateApr?: number;
  termYears?: number;
}
export interface OperatingInput {
  vacancyPct?: number;
  propertyTaxYearly?: number;
  insuranceYearly?: number;
  maintenancePctOfRent?: number;
  managementPctOfRent?: number;
}
export interface ComputeMetricsInput {
  price: number;
  monthlyRent?: number;
  market?: string;
  financing?: FinancingInput;
  operating?: OperatingInput;
}

const DEFAULT_FINANCING = { downPct: 0.25, rateApr: 0.07, termYears: 30 };
const DEFAULT_OPERATING = {
  vacancyPct: 0.05,
  propertyTaxYearly: 0,
  insuranceYearly: 0,
  maintenancePctOfRent: 0.08,
  managementPctOfRent: 0.08,
};

export function monthlyMortgagePayment(loanAmount: number, rateApr: number, termYears: number): number {
  if (loanAmount <= 0) return 0;
  const r = rateApr / 12;
  const n = termYears * 12;
  if (r === 0) return loanAmount / n;
  return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function inferRent(price: number): number {
  return Math.round(price * 0.0065);
}

export function computeMetrics(input: ComputeMetricsInput) {
  const fin = { ...DEFAULT_FINANCING, ...(input.financing ?? {}) };
  const op = { ...DEFAULT_OPERATING, ...(input.operating ?? {}) };
  const price = input.price;
  const monthlyRent = input.monthlyRent ?? inferRent(price);
  const downPayment = price * fin.downPct;
  const loanAmount = price - downPayment;
  const monthlyDebtService = monthlyMortgagePayment(loanAmount, fin.rateApr, fin.termYears);
  const propertyTaxYearly = op.propertyTaxYearly || price * 0.012;
  const insuranceYearly = op.insuranceYearly || price * 0.005;
  const vacancyMonthly = monthlyRent * op.vacancyPct;
  const maintenanceMonthly = monthlyRent * op.maintenancePctOfRent;
  const managementMonthly = monthlyRent * op.managementPctOfRent;
  const taxesMonthly = propertyTaxYearly / 12;
  const insuranceMonthly = insuranceYearly / 12;
  const operatingMonthly =
    vacancyMonthly + maintenanceMonthly + managementMonthly + taxesMonthly + insuranceMonthly;
  const totalMonthlyExpenses = operatingMonthly + monthlyDebtService;
  const noi = (monthlyRent - operatingMonthly) * 12;
  const capRate = noi / price;
  const monthlyCashFlow = monthlyRent - totalMonthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashInvested = downPayment + price * 0.03;
  const cashOnCash = cashInvested > 0 ? annualCashFlow / cashInvested : 0;
  return {
    capRate,
    cashOnCash,
    noi,
    monthlyCashFlow,
    monthlyDebtService,
    totalMonthlyExpenses,
    assumptions: {
      price,
      monthlyRent,
      downPct: fin.downPct,
      rateApr: fin.rateApr,
      termYears: fin.termYears,
      vacancyPct: op.vacancyPct,
      propertyTaxYearly,
      insuranceYearly,
      maintenancePctOfRent: op.maintenancePctOfRent,
      managementPctOfRent: op.managementPctOfRent,
      downPayment,
      loanAmount,
    },
  };
}

export function projectAmortizationSchedule(loanAmount: number, rateApr: number, termYears: number) {
  const r = rateApr / 12;
  const n = termYears * 12;
  const payment = monthlyMortgagePayment(loanAmount, rateApr, termYears);
  let balance = loanAmount;
  const yearly: { year: number; principalPaid: number; interestPaid: number; remainingBalance: number }[] = [];
  let yearlyPrincipal = 0;
  let yearlyInterest = 0;
  for (let m = 1; m <= n; m++) {
    const interest = balance * r;
    const principal = payment - interest;
    balance = Math.max(0, balance - principal);
    yearlyPrincipal += principal;
    yearlyInterest += interest;
    if (m % 12 === 0) {
      yearly.push({
        year: m / 12,
        principalPaid: yearlyPrincipal,
        interestPaid: yearlyInterest,
        remainingBalance: balance,
      });
      yearlyPrincipal = 0;
      yearlyInterest = 0;
    }
  }
  const totals = yearly.reduce(
    (acc, y) => ({
      totalPrincipal: acc.totalPrincipal + y.principalPaid,
      totalInterest: acc.totalInterest + y.interestPaid,
    }),
    { totalPrincipal: 0, totalInterest: 0 },
  );
  return { schedule: yearly, totals };
}

export interface ComputeRoiInput extends ComputeMetricsInput {
  holdYears: number;
  appreciationYoy?: number;
  rentGrowthYoy?: number;
}

export function computeRoi(input: ComputeRoiInput) {
  const base = computeMetrics(input);
  const appreciationYoy = input.appreciationYoy ?? 0.04;
  const rentGrowthYoy = input.rentGrowthYoy ?? 0.03;
  const holdYears = Math.max(1, Math.floor(input.holdYears));
  const { schedule } = projectAmortizationSchedule(
    base.assumptions.loanAmount,
    base.assumptions.rateApr,
    base.assumptions.termYears,
  );
  let propertyValue = base.assumptions.price;
  let monthlyRent = base.assumptions.monthlyRent;
  const years: any[] = [];
  let totalCashFlow = 0;
  let totalEquityBuildup = 0;
  for (let y = 1; y <= holdYears; y++) {
    const yearStartValue = propertyValue;
    propertyValue = yearStartValue * (1 + appreciationYoy);
    const appreciation = propertyValue - yearStartValue;
    const m = computeMetrics({ ...input, price: yearStartValue, monthlyRent });
    const rentIncome = monthlyRent * 12;
    const opex = (m.totalMonthlyExpenses - m.monthlyDebtService) * 12;
    const debtService = m.monthlyDebtService * 12;
    const cashFlow = m.monthlyCashFlow * 12;
    const equityBuildup = schedule[y - 1]?.principalPaid ?? 0;
    const totalReturn = cashFlow + equityBuildup + appreciation;
    totalCashFlow += cashFlow;
    totalEquityBuildup += equityBuildup;
    years.push({
      year: y,
      rentIncome,
      opex,
      noi: m.noi,
      debtService,
      cashFlow,
      equityBuildup,
      appreciation,
      propertyValueEndOfYear: propertyValue,
      totalReturn,
    });
    monthlyRent = monthlyRent * (1 + rentGrowthYoy);
  }
  const remainingBalance = schedule[holdYears - 1]?.remainingBalance ?? base.assumptions.loanAmount;
  const exitProceeds = propertyValue - remainingBalance;
  const totalAppreciation = propertyValue - base.assumptions.price;
  const initialCash = base.assumptions.downPayment + base.assumptions.price * 0.03;
  const totalReturn = totalCashFlow + (exitProceeds - base.assumptions.downPayment);
  const irr =
    initialCash > 0 ? Math.pow((initialCash + totalReturn) / initialCash, 1 / holdYears) - 1 : 0;
  return {
    years,
    totals: { totalCashFlow, totalAppreciation, totalEquityBuildup, totalReturn, exitProceeds, irr },
    assumptions: { ...base.assumptions, appreciationYoy, rentGrowthYoy, holdYears },
  };
}

export interface ComputeBuyingPowerInput {
  cashAvailable: number;
  downPct?: number;
  rateApr?: number;
  termYears?: number;
  markets: { name: string; medianListPrice: number; totalListings?: number }[];
}

function defaultAffordabilityCurve(price: number, median: number, total: number): number {
  if (median <= 0 || total <= 0) return 0;
  const ratio = price / median;
  const k = 3.5;
  const frac = 1 / (1 + Math.exp(-k * (ratio - 1)));
  return Math.round(frac * total);
}

export function computeBuyingPower(input: ComputeBuyingPowerInput) {
  const downPct = input.downPct ?? 0.25;
  const rateApr = input.rateApr ?? 0.07;
  const termYears = input.termYears ?? 30;
  const buyingPower = (input.cashAvailable * (1 - 0.03)) / downPct;
  const perMarket = input.markets.map((m) => {
    const total = m.totalListings ?? 100;
    const listingsAffordable = defaultAffordabilityCurve(buyingPower, m.medianListPrice, total);
    return {
      market: m.name,
      medianListPrice: m.medianListPrice,
      totalListings: total,
      listingsAffordable,
      affordabilityPct: total > 0 ? listingsAffordable / total : 0,
      headroomPct: m.medianListPrice > 0 ? (buyingPower - m.medianListPrice) / m.medianListPrice : 0,
    };
  });
  return { buyingPower, cashAvailable: input.cashAvailable, downPct, rateApr, termYears, perMarket };
}