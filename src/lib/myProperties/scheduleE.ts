import { supabase } from '@/integrations/supabase/client';
import type { OwnedProperty } from './types';
import {
  amortizedBalance,
  monthlyPI,
  monthsBetween,
} from './computeMetrics';

/**
 * Schedule E (Form 1040) — Supplemental Income and Loss for rental real estate.
 * We build one row per rental property for the given tax year with the most
 * common line items. Capitalized improvements are listed separately (not
 * expensed on Schedule E — they adjust basis / are depreciated).
 */

export interface ScheduleERow {
  property: string;
  address: string;
  city_state: string;
  rents_received: number;
  mortgage_interest: number;
  property_tax: number;
  insurance: number;
  hoa: number;
  management_fees: number;
  maintenance: number;
  total_expenses: number;
  net_income: number;
  capitalized_improvements: number;
}

function dateOverlapMonths(
  windowStart: Date,
  windowEnd: Date,
  leaseStart: string | null | undefined,
  leaseEnd: string | null | undefined,
): number {
  // If no lease window provided, assume rented for the entire window.
  const ls = leaseStart ? new Date(leaseStart) : windowStart;
  const le = leaseEnd ? new Date(leaseEnd) : windowEnd;
  const start = ls > windowStart ? ls : windowStart;
  const end = le < windowEnd ? le : windowEnd;
  if (end <= start) return 0;
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() >= start.getDate() ? 1 : 0);
  return Math.max(0, Math.min(12, months));
}

/**
 * Mortgage interest paid during the calendar year, derived from the
 * amortization schedule. Returns 0 if loan data is missing.
 */
function mortgageInterestForYear(p: OwnedProperty, year: number): number {
  if (!p.has_mortgage) return 0;
  const principal = Number(p.loan_original_principal ?? 0);
  const rate = Number(p.loan_rate_apr ?? 0);
  const term = Number(p.loan_term_years ?? 0);
  const startStr = p.loan_start_date;
  if (!principal || !rate || !term || !startStr) return 0;
  const start = new Date(startStr);
  const pi = monthlyPI(principal, rate, term);
  const r = rate / 12;
  let interest = 0;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  for (let m = 0; m < 12; m++) {
    const paymentDate = new Date(year, m, 1);
    if (paymentDate < start || paymentDate >= yearEnd) continue;
    const monthsElapsed = monthsBetween(start, paymentDate);
    const balBefore = amortizedBalance(principal, rate, term, monthsElapsed);
    const interestThisMonth = balBefore * r;
    if (interestThisMonth > 0 && pi > 0) interest += Math.min(interestThisMonth, pi);
  }
  // Suppress unused warning
  void yearStart;
  return Math.round(interest);
}

export async function buildScheduleERowsForYear(
  userId: string,
  year: number,
): Promise<ScheduleERow[]> {
  const { data: props } = await (supabase as any)
    .from('investor_owned_properties')
    .select('*')
    .eq('user_id', userId)
    .eq('is_rented', true)
    .neq('status', 'archived');
  if (!props || props.length === 0) return [];

  const propertyIds = props.map((p: any) => p.id);

  const [{ data: rentals }, { data: improvements }] = await Promise.all([
    (supabase as any)
      .from('investor_owned_property_rental')
      .select('*')
      .in('property_id', propertyIds),
    (supabase as any)
      .from('investor_owned_property_improvements')
      .select('*')
      .in('property_id', propertyIds),
  ]);

  const rentalByProp = new Map<string, any>();
  (rentals ?? []).forEach((r: any) => rentalByProp.set(r.property_id, r));
  const improvementsByProp = new Map<string, any[]>();
  (improvements ?? []).forEach((i: any) => {
    const y = new Date(i.improvement_date).getFullYear();
    if (y !== year) return;
    const arr = improvementsByProp.get(i.property_id) ?? [];
    arr.push(i);
    improvementsByProp.set(i.property_id, arr);
  });

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  return (props as OwnedProperty[]).map((p) => {
    const r = rentalByProp.get(p.id);
    const monthlyRent = Number(r?.monthly_rent ?? 0);
    const rentedMonths = r
      ? dateOverlapMonths(yearStart, yearEnd, r.lease_start, r.lease_end)
      : 12;
    const effectiveMonths = rentedMonths || 12;
    const grossRent = monthlyRent * effectiveMonths;
    const vacancyPct = Number(r?.vacancy_pct ?? 0.05);
    const rents = Math.round(grossRent * (1 - vacancyPct));

    const interest = mortgageInterestForYear(p, year);
    const propTax = Math.round(Number(r?.property_tax_yearly ?? 0));
    const insurance = Math.round(Number(r?.insurance_yearly ?? 0));
    const hoa = Math.round(Number(r?.hoa_monthly ?? 0) * 12);
    const mgmt = Math.round(grossRent * Number(r?.management_pct_of_rent ?? 0));
    const maint = Math.round(grossRent * Number(r?.maintenance_pct_of_rent ?? 0));
    const totalExpenses = interest + propTax + insurance + hoa + mgmt + maint;
    const net = rents - totalExpenses;
    const capImps = Math.round(
      (improvementsByProp.get(p.id) ?? []).reduce((sum, i) => sum + Number(i.cost ?? 0), 0),
    );

    return {
      property: p.address_line1,
      address: [p.address_line1, p.address_line2].filter(Boolean).join(' '),
      city_state: `${p.city}, ${p.state} ${p.zip}`,
      rents_received: rents,
      mortgage_interest: interest,
      property_tax: propTax,
      insurance,
      hoa,
      management_fees: mgmt,
      maintenance: maint,
      total_expenses: totalExpenses,
      net_income: net,
      capitalized_improvements: capImps,
    };
  });
}

const CSV_COLUMNS: Array<{ key: keyof ScheduleERow; label: string }> = [
  { key: 'property', label: 'Property' },
  { key: 'address', label: 'Address' },
  { key: 'city_state', label: 'City/State/ZIP' },
  { key: 'rents_received', label: 'Rents received' },
  { key: 'mortgage_interest', label: 'Mortgage interest' },
  { key: 'property_tax', label: 'Property tax' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'hoa', label: 'HOA' },
  { key: 'management_fees', label: 'Management fees' },
  { key: 'maintenance', label: 'Repairs & maintenance' },
  { key: 'total_expenses', label: 'Total expenses' },
  { key: 'net_income', label: 'Net rental income' },
  { key: 'capitalized_improvements', label: 'Capitalized improvements (not expensed)' },
];

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: ScheduleERow[], year: number): string {
  const header = CSV_COLUMNS.map((c) => csvEscape(c.label)).join(',');
  const body = rows
    .map((r) => CSV_COLUMNS.map((c) => csvEscape(r[c.key])).join(','))
    .join('\n');
  const banner =
    `Schedule E summary - Tax year ${year}\n` +
    `Generated ${new Date().toISOString().slice(0, 10)} - HomeLens AI\n` +
    `Note: figures are estimates derived from your saved rental data. Verify with your accountant before filing.\n\n`;
  return banner + header + '\n' + body + '\n';
}

export function downloadScheduleECsv(rows: ScheduleERow[], year: number) {
  const csv = rowsToCsv(rows, year);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schedule-e-${year}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}