import * as XLSX from 'xlsx';
import { InvestorInputs, ComputedResults, StressScenario } from './types';
import { formatCurrency, formatPercent } from '@/lib/calculations';

export function exportToExcel(inputs: InvestorInputs, results: ComputedResults, scenarios: StressScenario[]) {
  const wb = XLSX.utils.book_new();

  // Inputs sheet
  const inputsData = [
    ['HomeLens Investor Analysis'],
    [],
    ['Purchase & Financing'],
    ['Purchase Price', inputs.price],
    ['Down Payment (%)', inputs.downPct],
    ['Interest Rate (%)', inputs.ratePct],
    ['Loan Term (years)', inputs.years],
    ['Loan Type', inputs.loanType === 'fixed' ? 'Fixed Rate' : `ARM ${inputs.armPeriod}`],
    [],
    ['Rental Income'],
    ['Monthly Rent', inputs.rentMonthly],
    ['Vacancy Rate (%)', inputs.vacancyPct],
    ['Rent Growth (%/yr)', inputs.rentGrowthPct],
    [],
    ['Operating Expenses'],
    ['Property Tax (%)', inputs.taxPct],
    ['Insurance (annual)', inputs.insuranceAnnual],
    ['Repairs (% of rent)', inputs.repairsPct],
    ['CapEx Reserve (% of rent)', inputs.capexPct],
    ['Management (%)', inputs.selfManaged ? 0 : inputs.managementPct],
    ['HOA (monthly)', inputs.hoaMonthly],
    ['Expense Growth (%/yr)', inputs.expenseGrowthPct],
    [],
    ['Acquisition & Exit'],
    ['Closing Costs', results.closingCosts],
    ['State', inputs.state || 'N/A'],
    ['Selling Costs (%)', inputs.sellingCostsPct],
    ['Holding Period (years)', inputs.holdingPeriod],
    ['Appreciation (%/yr)', inputs.appreciationPct],
  ];
  const wsInputs = XLSX.utils.aoa_to_sheet(inputsData);
  XLSX.utils.book_append_sheet(wb, wsInputs, 'Inputs');

  // Monthly Cash Flow sheet
  const cfData = [
    ['Monthly Cash Flow Breakdown'],
    [],
    ['Gross Rental Income', inputs.rentMonthly],
    ['Vacancy Loss', -(inputs.rentMonthly - results.effectiveRent)],
    ['Effective Gross Income', results.effectiveRent],
    [],
    ['Mortgage (P&I)', -results.monthlyMortgage],
    ['PMI', -results.monthlyPMI],
    ['Property Tax', -results.monthlyTax],
    ['Insurance', -results.monthlyInsurance],
    ['Property Management', -results.monthlyManagement],
    ['Routine Maintenance', -results.monthlyRepairs],
    ['CapEx Reserve', -results.monthlyCapex],
    ['HOA', -results.monthlyHOA],
    [],
    ['NET CASH FLOW', results.monthlyCashFlow],
    ['Annual Cash Flow', results.monthlyCashFlow * 12],
  ];
  const wsCF = XLSX.utils.aoa_to_sheet(cfData);
  XLSX.utils.book_append_sheet(wb, wsCF, 'Monthly Cash Flow');

  // Metrics sheet
  const metricsData = [
    ['Investment Returns'],
    [],
    ['Metric', 'Value', 'Benchmark'],
    ['Cap Rate', `${results.capRate.toFixed(2)}%`, '>6% = Good'],
    ['Cash-on-Cash Return', `${results.cashOnCash.toFixed(2)}%`, '>8% = Good'],
    ['GRM', results.grm.toFixed(1), '<10 = Good'],
    ['DSCR', `${results.dscr.toFixed(2)}x`, '>1.25 = Good'],
    ['Break-Even Occupancy', `${results.breakEvenOccupancy.toFixed(1)}%`, '<85% = Good'],
    ['IRR', `${results.irr.toFixed(2)}%`, '>12% = Excellent'],
    [],
    ['Exit Analysis'],
    ['Projected Sale Price', results.projectedSalePrice],
    ['Selling Costs', -results.sellingCosts],
    ['Remaining Loan Balance', -results.remainingLoanBalance],
    ['Capital Gains Tax', -results.capitalGainsTax],
    ['Net Proceeds', results.netProceeds],
    ['Total Return', results.totalReturn],
  ];
  const wsMetrics = XLSX.utils.aoa_to_sheet(metricsData);
  XLSX.utils.book_append_sheet(wb, wsMetrics, 'Investment Returns');

  // Projections sheet
  const projHeader = ['Year', 'Property Value', 'Equity', 'Annual Rent', 'Annual NOI', 'Annual Cash Flow', 'Cumulative CF', 'Loan Balance'];
  const projRows = results.projections.map(p => [
    p.year, p.propertyValue, p.equity, p.annualRent, p.annualNOI, p.annualCashFlow, p.cumulativeCashFlow, p.loanBalance,
  ]);
  const wsProj = XLSX.utils.aoa_to_sheet([['Multi-Year Projections'], [], projHeader, ...projRows]);
  XLSX.utils.book_append_sheet(wb, wsProj, 'Projections');

  // Stress Test sheet
  const stressHeader = ['Scenario', 'Vacancy %', 'Rent Growth %', 'Appreciation %', 'Monthly Cash Flow', 'CoC Return %'];
  const stressRows = scenarios.map(s => [s.label, s.vacancyPct, s.rentGrowthPct, s.appreciationPct, s.monthlyCashFlow, s.cashOnCash]);
  const wsStress = XLSX.utils.aoa_to_sheet([['Stress Test'], [], stressHeader, ...stressRows]);
  XLSX.utils.book_append_sheet(wb, wsStress, 'Stress Test');

  const stateStr = inputs.state || 'US';
  const year = new Date().getFullYear();
  XLSX.writeFile(wb, `homelens-investor-analysis-${stateStr}-${year}.xlsx`);
}
