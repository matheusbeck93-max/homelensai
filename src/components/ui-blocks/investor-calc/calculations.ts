import { InvestorInputs, ComputedResults, YearProjection, StressScenario, STATE_CAPITAL_GAINS_RATES } from './types';

function calcMonthlyMortgage(loanAmount: number, ratePct: number, years: number): number {
  const monthlyRate = ratePct / 100 / 12;
  const n = years * 12;
  if (monthlyRate <= 0) return n > 0 ? loanAmount / n : 0;
  return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
}

function calcLoanBalance(loanAmount: number, ratePct: number, years: number, monthsPaid: number): number {
  const monthlyRate = ratePct / 100 / 12;
  const n = years * 12;
  if (monthsPaid >= n) return 0;
  if (monthlyRate <= 0) return Math.max(0, loanAmount - (loanAmount / n) * monthsPaid);
  const payment = calcMonthlyMortgage(loanAmount, ratePct, years);
  return loanAmount * Math.pow(1 + monthlyRate, monthsPaid) - payment * ((Math.pow(1 + monthlyRate, monthsPaid) - 1) / monthlyRate);
}

function getArmInitialYears(armPeriod: string): number {
  return parseInt(armPeriod.split('/')[0]) || 7;
}

export function computeResults(inputs: InvestorInputs): ComputedResults {
  const downPayment = inputs.price * (inputs.downPct / 100);
  const loanAmount = inputs.price - downPayment;
  const closingCosts = inputs.closingCostsMode === 'percent'
    ? inputs.price * (inputs.closingCostsPct / 100)
    : inputs.closingCostsDollar;
  const totalCashInvested = downPayment + closingCosts;

  // Initial monthly mortgage (at initial rate)
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

  // ARM scenario (year 1 vs post-adjustment comparison)
  const isArm = inputs.loanType === 'arm';
  const armInitialYears = isArm ? getArmInitialYears(inputs.armPeriod) : inputs.years;
  const postArmRate = inputs.armExpectedRate ?? (inputs.ratePct + inputs.armRateCap);

  let armMonthlyMortgage: number | undefined;
  let armMonthlyCashFlow: number | undefined;
  if (isArm) {
    // Compute balance at ARM adjustment point
    const balAtAdj = Math.max(0, calcLoanBalance(loanAmount, inputs.ratePct, inputs.years, armInitialYears * 12));
    const remainingTerm = inputs.years - armInitialYears;
    if (remainingTerm > 0 && balAtAdj > 0) {
      armMonthlyMortgage = calcMonthlyMortgage(balAtAdj, postArmRate, remainingTerm);
    } else {
      armMonthlyMortgage = monthlyMortgage;
    }
    // PMI may or may not apply after ARM adjustment
    const pmiAfterAdj = (inputs.downPct < 20 && balAtAdj > inputs.price * 0.80) ? monthlyPMI : 0;
    const armTotalExpenses = (armMonthlyMortgage ?? monthlyMortgage) + pmiAfterAdj + monthlyTax + monthlyInsurance +
      monthlyRepairs + monthlyCapex + monthlyManagement + monthlyHOA;
    armMonthlyCashFlow = effectiveRent - armTotalExpenses;
  }

  // Full year-by-year projections (ARM-aware, PMI-aware)
  const displayYears = [1, 2, 3, 5, 10, inputs.holdingPeriod];
  const uniqueDisplayYears = [...new Set(displayYears)].filter(y => y > 0).sort((a, b) => a - b);
  const maxYear = Math.max(inputs.holdingPeriod, ...uniqueDisplayYears);

  const fullProjections: YearProjection[] = [];
  let cumCF = 0;

  // Pre-compute ARM transition values
  const balanceAtArmAdj = isArm
    ? Math.max(0, calcLoanBalance(loanAmount, inputs.ratePct, inputs.years, armInitialYears * 12))
    : 0;
  const remainingTermAfterArm = inputs.years - armInitialYears;
  const postArmPayment = isArm && remainingTermAfterArm > 0 && balanceAtArmAdj > 0
    ? calcMonthlyMortgage(balanceAtArmAdj, postArmRate, remainingTermAfterArm)
    : monthlyMortgage;

  for (let y = 1; y <= maxYear; y++) {
    const propValue = inputs.price * Math.pow(1 + inputs.appreciationPct / 100, y);

    // Loan balance and mortgage payment (ARM-aware)
    let loanBal: number;
    let mortPayment: number;

    if (isArm && y > armInitialYears && remainingTermAfterArm > 0 && balanceAtArmAdj > 0) {
      mortPayment = postArmPayment;
      loanBal = Math.max(0, calcLoanBalance(balanceAtArmAdj, postArmRate, remainingTermAfterArm, (y - armInitialYears) * 12));
    } else {
      mortPayment = monthlyMortgage;
      loanBal = Math.max(0, calcLoanBalance(loanAmount, inputs.ratePct, inputs.years, y * 12));
    }

    // PMI: stops when loan balance <= 80% of original purchase price
    const pmiThisYear = (inputs.downPct < 20 && loanBal > inputs.price * 0.80)
      ? (loanAmount * 0.01) / 12
      : 0;

    // Rent and expenses for this year
    const rentY = inputs.rentMonthly * Math.pow(1 + inputs.rentGrowthPct / 100, y - 1);
    const effRentY = rentY * (1 - inputs.vacancyPct / 100);
    const expGrowth = Math.pow(1 + inputs.expenseGrowthPct / 100, y - 1);
    const mgmtY = inputs.selfManaged ? 0 : rentY * (mgmtPct / 100);
    const taxY = (inputs.price * (inputs.taxPct / 100)) / 12 * expGrowth;
    const insY = (inputs.insuranceAnnual / 12) * expGrowth;
    const repairsY = rentY * (inputs.repairsPct / 100);
    const capexY = rentY * (inputs.capexPct / 100);

    const totalExpY = mortPayment + pmiThisYear + taxY + insY + repairsY + capexY + mgmtY + inputs.hoaMonthly;
    const annualCashFlowY = (effRentY - totalExpY) * 12;
    cumCF += annualCashFlowY;

    const opExY = (taxY + insY + repairsY + capexY + mgmtY + inputs.hoaMonthly) * 12;
    const noiY = effRentY * 12 - opExY;

    const appreciationEquity = propValue - inputs.price;
    const amortizationEquity = loanAmount - loanBal;

    fullProjections.push({
      year: y,
      propertyValue: propValue,
      equity: propValue - loanBal,
      appreciationEquity,
      amortizationEquity,
      annualRent: rentY * 12,
      annualNOI: noiY,
      annualCashFlow: annualCashFlowY,
      cumulativeCashFlow: cumCF,
      loanBalance: loanBal,
    });
  }

  // Filter for display
  const projections = fullProjections.filter(p => uniqueDisplayYears.includes(p.year));

  // Exit calculations
  const hp = inputs.holdingPeriod;
  const projectedSalePrice = inputs.price * Math.pow(1 + inputs.appreciationPct / 100, hp);
  const sellingCosts = projectedSalePrice * (inputs.sellingCostsPct / 100);
  const holdingProj = fullProjections.find(p => p.year === hp);
  const remainingLoanBalance = holdingProj?.loanBalance ?? Math.max(0, calcLoanBalance(loanAmount, inputs.ratePct, inputs.years, hp * 12));

  // Capital gains — separate federal and state
  const gain = projectedSalePrice - inputs.price - sellingCosts;
  const stateCapGainsRate = STATE_CAPITAL_GAINS_RATES[inputs.state] ?? 0;
  let federalCapitalGainsTax = 0;
  let stateCapitalGainsTax = 0;

  if (gain > 0) {
    let taxableGain = gain;
    if (inputs.investorProfile === 'primary' && hp >= 2) {
      taxableGain = Math.max(0, gain - 250000);
    }
    federalCapitalGainsTax = taxableGain * (inputs.marginalTaxRate / 100);
    stateCapitalGainsTax = taxableGain * (stateCapGainsRate / 100);
  }

  const capitalGainsTax = federalCapitalGainsTax + stateCapitalGainsTax;
  const netProceeds = projectedSalePrice - sellingCosts - remainingLoanBalance - capitalGainsTax;
  const cumulativeCF = holdingProj?.cumulativeCashFlow ?? 0;
  const totalReturn = netProceeds + cumulativeCF - totalCashInvested;

  // IRR calculation using Newton's method (uses full year-by-year data)
  const irr = calcIRR(totalCashInvested, fullProjections, netProceeds, hp);

  return {
    loanAmount, downPayment, closingCosts, totalCashInvested,
    monthlyMortgage, monthlyPMI,
    effectiveRent,
    monthlyTax, monthlyInsurance, monthlyRepairs, monthlyCapex, monthlyManagement, monthlyHOA,
    totalMonthlyExpenses, monthlyCashFlow, annualNOI,
    capRate, cashOnCash, grm, dscr, breakEvenOccupancy, breakEvenRent,
    armMonthlyMortgage, armMonthlyCashFlow,
    projections, irr,
    projectedSalePrice, sellingCosts, remainingLoanBalance,
    capitalGainsTax, federalCapitalGainsTax, stateCapitalGainsTax, stateCapitalGainsRate: stateCapGainsRate,
    netProceeds, totalReturn,
  };
}

function calcIRR(initialInvestment: number, fullProjections: YearProjection[], netProceeds: number, holdingPeriod: number): number {
  const cashFlows: number[] = [-initialInvestment];
  for (let y = 1; y <= holdingPeriod; y++) {
    const proj = fullProjections.find(p => p.year === y);
    let cf = proj?.annualCashFlow ?? 0;
    if (y === holdingPeriod) cf += netProceeds;
    cashFlows.push(cf);
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
  const isArm = inputs.loanType === 'arm';
  const currentArmRate = inputs.armExpectedRate ?? (inputs.ratePct + inputs.armRateCap);

  const bear: InvestorInputs = {
    ...inputs,
    vacancyPct: inputs.vacancyPct + 10,
    rentGrowthPct: 0,
    appreciationPct: 0,
    ...(isArm ? { armExpectedRate: currentArmRate + 1 } : {}),
  };
  const base = inputs;
  const bull: InvestorInputs = {
    ...inputs,
    vacancyPct: Math.max(0, inputs.vacancyPct - 5),
    rentGrowthPct: 5,
    appreciationPct: 5,
    ...(isArm ? { armExpectedRate: Math.max(0, currentArmRate - 1) } : {}),
  };

  const bearR = computeResults(bear);
  const baseR = computeResults(base);
  const bullR = computeResults(bull);

  return [
    { label: 'Bear Case', vacancyPct: bear.vacancyPct, rentGrowthPct: 0, appreciationPct: 0, monthlyCashFlow: bearR.monthlyCashFlow, cashOnCash: bearR.cashOnCash },
    { label: 'Base Case', vacancyPct: base.vacancyPct, rentGrowthPct: base.rentGrowthPct, appreciationPct: base.appreciationPct, monthlyCashFlow: baseR.monthlyCashFlow, cashOnCash: baseR.cashOnCash },
    { label: 'Bull Case', vacancyPct: bull.vacancyPct, rentGrowthPct: 5, appreciationPct: 5, monthlyCashFlow: bullR.monthlyCashFlow, cashOnCash: bullR.cashOnCash },
  ];
}
