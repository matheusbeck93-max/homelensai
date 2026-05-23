export type Importance = "low" | "medium" | "high" | null;

export interface Preferences {
  goal?: string | null;
  buyer_type?: string | null;
  locations?: string[];
  budget?: {
    purchase_price_max?: number | null;
    monthly_payment_max?: number | null;
    down_payment?: number | null;
  };
  property?: {
    types?: string[];
    bedrooms_min?: number | null;
    bathrooms_min?: number | null;
    sqft_min?: number | null;
  };
  lifestyle?: {
    schools_importance?: Importance;
    commute_importance?: Importance;
    safety_importance?: Importance;
    walkability_importance?: Importance;
    parks_importance?: Importance;
  };
  investment?: {
    strategy?: string | null;
    cash_flow_target?: number | null;
    appreciation_focus?: boolean | null;
    fixer_upper_ok?: boolean | null;
    risk_tolerance?: "low" | "medium" | "high" | null;
  };
  must_haves?: string[];
  nice_to_haves?: string[];
  deal_breakers?: string[];
  freeform_notes?: string;
  updated_at?: string;
}

export const EMPTY_PREFERENCES: Preferences = {
  goal: null,
  buyer_type: null,
  locations: [],
  budget: { purchase_price_max: null, monthly_payment_max: null, down_payment: null },
  property: { types: [], bedrooms_min: null, bathrooms_min: null, sqft_min: null },
  lifestyle: {
    schools_importance: null,
    commute_importance: null,
    safety_importance: null,
    walkability_importance: null,
    parks_importance: null,
  },
  investment: {
    strategy: null,
    cash_flow_target: null,
    appreciation_focus: null,
    fixer_upper_ok: null,
    risk_tolerance: null,
  },
  must_haves: [],
  nice_to_haves: [],
  deal_breakers: [],
  freeform_notes: "",
};