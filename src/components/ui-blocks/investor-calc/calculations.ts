import { InvestorInputs, ComputedResults, YearProjection, StressScenario } from './types';

function calcMonthlyMortgage(loanAmount: number, ratePct: number, years: number): number {
  const monthlyRate = ratePct / 100 / 12;
  const n = years * 12;
  if (monthlyRate <= 0) return n > 0 ? loanAmount / n : 0;
  return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
}

function calcLoanBalance(loanAmount: number, ratePct: number, years: number, monthsPaid: number): number {
  const monthlyRate = ratePct / 100 / 12;
  const n = years * 12;
  if (monthlyRate <= 0) return Math.max(0, loanAmount - (loanAmount / n) * monthsPaid);
  const payment = calcMonthlyMortgage(loanAmount, ratePct, years);
  return loanAmount * Math.pow(1 + monthlyRate, monthsPaid) - payment * ((Math.pow(1 + monthlyRate, monthsPaid) - 1) / monthlyRate);
}

export function computeResults(inputs: InvestorInputs): ComputedResults {
  const downPayment = inputs.price * (inputs.downPct / 100);
  const loanAmount = inputs.price - downPayment;
  const closingCosts = inputs.closingCostsMode === 'percent'
    ? inputs.price * (inputs.closingCostsPct / 100)
    : inputs.closingCostsDollar;
  const totalCashInvested = downPayment + closingCosts;

  const monthlyMortgage = calcMonthlyMortgage(loanAmount, inputs.ratePct, inputs.years);
  const monthlyPMI = inputs.downPct < 20 ? (loanAmount * 0.01) / 12 : 0;

  const effectiveRent = inputs.rentMonthly * (1 - inputs.vacancyPct / 100);
  const mgmtPct = inputs.selfManaged ? 0 : inputs.managementPct;

  const monthlyTax = (inputs.price * (inputs.taxPct / 100)) / 12;
  const monthlyInsurance = inputs.insuranceAnnual / 12;
  const monthlyRepairs = inputs.rentMonthly * (inputs.repairsPct / 100);
  const monthlyCapex = inputs.rentMonthly * (inputs.capexPct / 100);
  const monthlyManagement = inputs.rentMonthly * (mgmtPct / 100);
  const monthlyHOA = inputs.hoaMonthly;

  const totalMonthlyExpenses = monthlyMortgage + monthlyPMI + monthlyTax + monthlyInsurance +
    monthlyRepairs + monthlyCapex + monthlyManagement + monthlyHOA;

  const monthlyCashFlow = effectiveRent - totalMonthlyExpenses;

  const annualOpEx = (monthlyTax + monthlyInsurance + monthlyRepairs + monthlyCapex + monthlyManagement + monthlyHOA) * 12;
  const annualNOI = (effectiveRent * 12) - annualOpEx;

  const capRate = inputs.price > 0 ? (annualNOI / inputs.price) * 100 : 0;
  const cashOnCash = totalCashInvested > 0 ? ((monthlyCashFlow * 12) / totalCashInvested) * 100 : 0;
  const grm = inputs.rentMonthly > 0 ? inputs.price / (inputs.rentMonthly * 12) : 0;
  const annualDebtService = (monthlyMortgage + monthlyPMI) * 12;
  const dscr = annualDebtService > 0 ? annualNOI / annualDebtService : 0;
  const breakEvenOccupancy = inputs.rentMonthly > 0 ? (totalMonthlyExpenses / inputs.rentMonthly) * 100 : 0;
  const breakEvenRent = (1 - inputs.vacancyPct / 100) > 0 ? totalMonthlyExpenses / (1 - inputs.vacancyPct / 100) : 0;

  // ARM scenario
  let armMonthlyMortgage: number | undefined;
  let armMonthlyCashFlow: number | undefined;
  if (inputs.loanType === 'arm') {
    const armRate = inputs.ratePct + inputs.armRateCap;
    armMonthlyMortgage = calcMonthlyMortgage(loanAmount, armRate, inputs.years);
    const armTotalExpenses = armMonthlyMortgage + monthlyPMI + monthlyTax + monthlyInsurance +
      monthlyRepairs + monthlyCapex + monthlyManagement + monthlyHOA;
    armMonthlyCashFlow = effectiveRent - armTotalExpenses;
  }

  // Projections
  const projections: YearProjection[] = [];
  let cumulativeCashFlow = 0;
  const yearsToProject = [1, 2, 3, 5, 10, inputs.holdingPeriod];
  const uniqueYears = [...new Set(yearsToProject)].filter(y => y > 0).sort((a, b) => a - b);

  for (const year of uniqueYears) {
    const propValue = inputs.price * Math.pow(1 + inputs.appreciationPct / 100, year);
    const loanBal = Math.max(0, calcLoanBalance(loanAmount, inputs.ratePct, inputs.years, year * 12));

    // Compound rent and expense growth
    let yearCashFlow = 0;
    for (let y = (year === uniqueYears[0] ? 1 : (uniqueYears[uniqueYears.indexOf(year) - 1] || 0) + 1); y <= year; y++) {
      const rentY = inputs.rentMonthly * Math.pow(1 + inputs.rentGrowthPct / 100, y - 1);
      const effRentY = rentY * (1 - inputs.vacancyPct / 100);
      const mgmtY = inputs.selfManaged ? 0 : rentY * (inputs.managementPct / 100);
      const repairsY = rentY * (inputs.repairsPct / 100);
      const capexY = rentY * (inputs.capexPct / 100);
      const expGrowth = Math.pow(1 + inputs.expenseGrowthPct / 100, y - 1);
      const taxY = (inputs.price * (inputs.taxPct / 100)) / 12 * expGrowth;
      const insY = (inputs.insuranceAnnual / 12) * expGrowth;
      const totalExpY = monthlyMortgage + monthlyPMI + taxY + insY + repairsY + capexY + mgmtY + inputs.hoaMonthly;
      yearCashFlow += (effRentY - totalExpY) * 12;
    }

    // For simpler computation, recalculate for this specific year
    const rentThisYear = inputs.rentMonthly * Math.pow(1 + inputs.rentGrowthPct / 100, year - 1);
    const effRentThisYear = rentThisYear * (1 - inputs.vacancyPct / 100);
    const expGrowth = Math.pow(1 + inputs.expenseGrowthPct / 100, year - 1);
    const mgmtThisYear = inputs.selfManaged ? 0 : rentThisYear * (inputs.managementPct / 100);
    const opExThisYear = ((inputs.price * (inputs.taxPct / 100)) / 12 * expGrowth +
      (inputs.insuranceAnnual / 12) * expGrowth +
      rentThisYear * (inputs.repairsPct / 100) +
      rentThisYear * (inputs.capexPct / 100) +
      mgmtThisYear + inputs.hoaMonthly) * 12;
    const noiThisYear = effRentThisYear * 12 - opExThisYear;
    const cashFlowThisYear = noiThisYear - (monthlyMortgage + monthlyPMI) * 12;

    // Cumulative: sum all years' cash flows
    let cumCF = 0;
    for (let y = 1; y <= year; y++) {
      const rY = inputs.rentMonthly * Math.pow(1 + inputs.rentGrowthPct / 100, y - 1);
      const eRY = rY * (1 - inputs.vacancyPct / 100);
      const eG = Math.pow(1 + inputs.expenseGrowthPct / 100, y - 1);
      const mY = inputs.selfManaged ? 0 : rY * (inputs.managementPct / 100);
      const oY = ((inputs.price * (inputs.taxPct / 100)) / 12 * eG +
        (inputs.insuranceAnnual / 12) * eG +
        rY * (inputs.repairsPct / 100) +
        rY * (inputs.capexPct / 100) +
        mY + inputs.hoaMonthly) * 12;
      cumCF += eRY * 12 - oY - (monthlyMortgage + monthlyPMI) * 12;
    }

    const appreciationEquity = propValue - inputs.price;
    const amortizationEquity = loanAmount - loanBal;

    projections.push({
      year,
      propertyValue: propValue,
      equity: propValue - loanBal,
      appreciationEquity,
      amortizationEquity,
      annualRent: rentThisYear * 12,
      annualNOI: noiThisYear,
      annualCashFlow: cashFlowThisYear,
      cumulativeCashFlow: cumCF,
      loanBalance: loanBal,
    });
  }

  // Exit calculations
  const hp = inputs.holdingPeriod;
  const projectedSalePrice = inputs.price * Math.pow(1 + inputs.appreciationPct / 100, hp);
  const sellingCosts = projectedSalePrice * (inputs.sellingCostsPct / 100);
  const remainingLoanBalance = Math.max(0, calcLoanBalance(loanAmount, inputs.ratePct, inputs.years, hp * 12));

  // Capital gains
  const gain = projectedSalePrice - inputs.price - sellingCosts;
  let capitalGainsTax = 0;
  if (gain > 0) {
    if (inputs.investorProfile === 'primary' && hp >= 2) {
      const taxableGain = Math.max(0, gain - 250000); // Single exemption
      capitalGainsTax = taxableGain * (inputs.marginalTaxRate / 100);
    } else {
      capitalGainsTax = gain * (inputs.marginalTaxRate / 100);
    }
  }

  const netProceeds = projectedSalePrice - sellingCosts - remainingLoanBalance - capitalGainsTax;
  const holdingProjection = projections.find(p => p.year === hp);
  const cumulativeCF = holdingProjection?.cumulativeCashFlow || 0;
  const totalReturn = netProceeds + cumulativeCF - totalCashInvested;

  // IRR calculation using Newton's method
  const irr = calcIRR(totalCashInvested, projections, netProceeds, hp);

  return {
    loanAmount, downPayment, closingCosts, totalCashInvested,
    monthlyMortgage, monthlyPMI,
    effectiveRent,
    monthlyTax, monthlyInsurance, monthlyRepairs, monthlyCapex, monthlyManagement, monthlyHOA,
    totalMonthlyExpenses, monthlyCashFlow, annualNOI,
    capRate, cashOnCash, grm, dscr, breakEvenOccupancy, breakEvenRent,
    armMonthlyMortgage, armMonthlyCashFlow,
    projections, irr,
    projectedSalePrice, sellingCosts, remainingLoanBalance, capitalGainsTax, netProceeds, totalReturn,
  };
}

function calcIRR(initialInvestment: number, projections: YearProjection[], netProceeds: number, holdingPeriod: number): number {
  // Build cash flow array: year 0 = -investment, years 1..hp = annual cash flow, year hp += netProceeds
  const cashFlows: number[] = [-initialInvestment];
  for (let y = 1; y <= holdingPeriod; y++) {
    const proj = projections.find(p => p.year === y);
    let cf = 0;
    if (proj) {
      cf = proj.annualCashFlow;
    }
    if (y === holdingPeriod) {
      cf += netProceeds;
    }
    cashFlows.push(cf);
  }

  // Fill gaps
  while (cashFlows.length <= holdingPeriod) {
    cashFlows.push(0);
  }

  // Newton-Raphson IRR
  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + rate, t);
      if (t > 0) dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(dnpv) < 1e-10) break;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < 1e-6) { rate = newRate; break; }
    rate = newRate;
  }

  return isFinite(rate) ? rate * 100 : 0;
}

export function computeStressScenarios(inputs: InvestorInputs): StressScenario[] {
  const bear: InvestorInputs = { ...inputs, vacancyPct: inputs.vacancyPct + 10, rentGrowthPct: 0, appreciationPct: 0 };
  const base = inputs;
  const bull: InvestorInputs = { ...inputs, vacancyPct: Math.max(0, inputs.vacancyPct - 5), rentGrowthPct: 5, appreciationPct: 5 };

  const bearR = computeResults(bear);
  const baseR = computeResults(base);
  const bullR = computeResults(bull);

  return [
    { label: 'Bear Case', vacancyPct: bear.vacancyPct, rentGrowthPct: 0, appreciationPct: 0, monthlyCashFlow: bearR.monthlyCashFlow, cashOnCash: bearR.cashOnCash },
    { label: 'Base Case', vacancyPct: base.vacancyPct, rentGrowthPct: base.rentGrowthPct, appreciationPct: base.appreciationPct, monthlyCashFlow: baseR.monthlyCashFlow, cashOnCash: baseR.cashOnCash },
    { label: 'Bull Case', vacancyPct: bull.vacancyPct, rentGrowthPct: 5, appreciationPct: 5, monthlyCashFlow: bullR.monthlyCashFlow, cashOnCash: bullR.cashOnCash },
  ];
}
