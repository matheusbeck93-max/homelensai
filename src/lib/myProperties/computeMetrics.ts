import type { OwnedProperty } from './types';

/**
 * Standard amortization: remaining balance after `monthsElapsed` payments.
 */
export function amortizedBalance(
  originalPrincipal: number,
  rateApr: number,
  termYears: number,
  monthsElapsed: number,
): number {
  if (!originalPrincipal || rateApr <= 0 || termYears <= 0) return originalPrincipal ?? 0;
  const r = rateApr / 12;
  const n = termYears * 12;
  const k = Math.max(0, Math.min(monthsElapsed, n));
  const pow = Math.pow(1 + r, n);
  const powK = Math.pow(1 + r, k);
  // Bal = P * (pow - powK) / (pow - 1)
  return originalPrincipal * (pow - powK) / (pow - 1);
}

export function monthsBetween(start: string | Date, end: string | Date = new Date()): number {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

export function monthlyPI(principal: number, rateApr: number, termYears: number): number {
  if (!principal) return 0;
  if (rateApr <= 0) return principal / (termYears * 12);
  const r = rateApr / 12;
  const n = termYears * 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function computeCurrentLoanBalance(p: OwnedProperty): number {
  if (!p.has_mortgage) return 0;
  if (p.loan_current_balance != null) return Number(p.loan_current_balance);
  if (!p.loan_original_principal || !p.loan_rate_apr || !p.loan_term_years || !p.loan_start_date) {
    return Number(p.loan_original_principal ?? 0);
  }
  const months = monthsBetween(p.loan_start_date);
  return amortizedBalance(
    Number(p.loan_original_principal),
    Number(p.loan_rate_apr),
    Number(p.loan_term_years),
    months,
  );
}

export function computeEquity(p: OwnedProperty): {
  currentValue: number;
  loanBalance: number;
  equity: number;
  equityPct: number;
} {
  const currentValue = Number(p.current_value_estimate ?? p.purchase_price ?? 0);
  const loanBalance = computeCurrentLoanBalance(p);
  const equity = Math.max(0, currentValue - loanBalance);
  const equityPct = currentValue > 0 ? equity / currentValue : 0;
  return { currentValue, loanBalance, equity, equityPct };
}

export function computeAppreciation(p: OwnedProperty): {
  absolute: number;
  pct: number;
} {
  const purchase = Number(p.purchase_price ?? 0);
  const current = Number(p.current_value_estimate ?? purchase);
  const absolute = current - purchase;
  const pct = purchase > 0 ? absolute / purchase : 0;
  return { absolute, pct };
}

/**
 * Monthly cash flow estimate for a rented property.
 * Requires rental detail row; pass it in separately for now.
 */
export interface RentalDetail {
  monthly_rent: number | null;
  property_tax_yearly: number | null;
  insurance_yearly: number | null;
  hoa_monthly: number | null;
  maintenance_pct_of_rent: number | null;
  management_pct_of_rent: number | null;
  vacancy_pct: number | null;
}

export function computeMonthlyCashFlow(
  p: OwnedProperty,
  rental: RentalDetail | null,
): number {
  if (!p.is_rented || !rental || !rental.monthly_rent) return 0;
  const rent = Number(rental.monthly_rent);
  const tax = Number(rental.property_tax_yearly ?? 0) / 12;
  const ins = Number(rental.insurance_yearly ?? 0) / 12;
  const hoa = Number(rental.hoa_monthly ?? 0);
  const maint = rent * Number(rental.maintenance_pct_of_rent ?? 0.08);
  const mgmt = rent * Number(rental.management_pct_of_rent ?? 0.08);
  const vac = rent * Number(rental.vacancy_pct ?? 0.05);
  const piti =
    p.has_mortgage && p.loan_original_principal && p.loan_rate_apr && p.loan_term_years
      ? monthlyPI(
          Number(p.loan_original_principal),
          Number(p.loan_rate_apr),
          Number(p.loan_term_years),
        )
      : 0;
  return rent - (tax + ins + hoa + maint + mgmt + vac + piti);
}

export function computeCapRate(
  p: OwnedProperty,
  rental: RentalDetail | null,
): number | null {
  if (!p.is_rented || !rental || !rental.monthly_rent) return null;
  const value = Number(p.current_value_estimate ?? p.purchase_price ?? 0);
  if (value <= 0) return null;
  const rent = Number(rental.monthly_rent);
  const tax = Number(rental.property_tax_yearly ?? 0);
  const ins = Number(rental.insurance_yearly ?? 0);
  const hoa = Number(rental.hoa_monthly ?? 0) * 12;
  const maint = rent * Number(rental.maintenance_pct_of_rent ?? 0.08) * 12;
  const mgmt = rent * Number(rental.management_pct_of_rent ?? 0.08) * 12;
  const vac = rent * Number(rental.vacancy_pct ?? 0.05) * 12;
  const noi = rent * 12 - (tax + ins + hoa + maint + mgmt + vac);
  return noi / value;
}

/**
 * Total return decomposition (lifetime, not annualized) since purchase.
 * - appreciation: current value − purchase price
 * - principalPaydown: original loan − current loan balance
 * - cashFlow: monthly cash flow × months held (only when rented)
 */
export function computeReturnsDecomposition(
  p: OwnedProperty,
  rental: RentalDetail | null,
): {
  appreciation: number;
  principalPaydown: number;
  cashFlow: number;
  total: number;
  cashInvested: number;
  totalROI: number | null;
} {
  const app = computeAppreciation(p).absolute;
  const orig = Number(p.loan_original_principal ?? 0);
  const principalPaydown = orig > 0 ? Math.max(0, orig - computeCurrentLoanBalance(p)) : 0;
  const months = Math.max(0, monthsBetween(p.purchase_date));
  const cf = computeMonthlyCashFlow(p, rental) * months;
  const total = app + principalPaydown + cf;
  const cashInvested =
    Number(p.down_payment ?? 0) + Number(p.closing_costs ?? 0);
  const totalROI = cashInvested > 0 ? total / cashInvested : null;
  return {
    appreciation: app,
    principalPaydown,
    cashFlow: cf,
    total,
    cashInvested,
    totalROI,
  };
}