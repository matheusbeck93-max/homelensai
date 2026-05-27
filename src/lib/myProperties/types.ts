export type OwnedPropertyType =
  | 'single_family'
  | 'townhome'
  | 'condo'
  | 'duplex'
  | 'triplex'
  | 'fourplex'
  | 'multifamily'
  | 'land'
  | 'other';

export type OwnedPropertyStatus = 'active' | 'sold' | 'archived';

export type ValuationSource =
  | 'zestimate'
  | 'realtor'
  | 'rentcast'
  | 'manual_appraisal'
  | 'manual_override'
  | 'seed';

export interface OwnedProperty {
  id: string;
  user_id: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  property_type: OwnedPropertyType;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_sqft: number | null;
  year_built: number | null;
  purchase_date: string;
  purchase_price: number;
  down_payment: number | null;
  closing_costs: number | null;
  has_mortgage: boolean;
  loan_original_principal: number | null;
  loan_rate_apr: number | null;
  loan_term_years: number | null;
  loan_start_date: string | null;
  loan_current_balance: number | null;
  loan_current_balance_as_of: string | null;
  is_primary_residence: boolean;
  is_rented: boolean;
  current_value_estimate: number | null;
  current_value_source: ValuationSource | null;
  current_value_confidence_low: number | null;
  current_value_confidence_high: number | null;
  current_value_refreshed_at: string | null;
  current_value_manual_override: number | null;
  current_value_manual_note: string | null;
  current_value_manual_expires_at: string | null;
  primary_photo_url: string | null;
  auto_refresh_enabled: boolean;
  status: OwnedPropertyStatus;
  sold_date: string | null;
  sold_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioRollup {
  count: number;
  totalEquity: number;
  totalMonthlyCashFlow: number;
  weightedAvgCapRate: number | null;
  totalAppreciation: number;
  topMarketShare: { market: string; pct: number } | null;
}

export const PROPERTY_TYPE_LABELS: Record<OwnedPropertyType, string> = {
  single_family: 'Single family',
  townhome: 'Townhome',
  condo: 'Condo',
  duplex: 'Duplex',
  triplex: 'Triplex',
  fourplex: 'Fourplex',
  multifamily: 'Multifamily',
  land: 'Land',
  other: 'Other',
};