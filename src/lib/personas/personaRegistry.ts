/**
 * Persona registry — single source of truth for investor personas, KPI
 * priorities, tool selection weights, and brief card ranking weights.
 *
 * Persona is a BIAS, not a filter. The AI may still call any tool when the
 * user's question demands it; weights only steer default tool selection on
 * open-ended questions and brief card ranking.
 */

export type PersonaId =
  | 'first_time_buyer'
  | 'rental_investor'
  | 'flipper'
  | 'institutional'
  | 'mixed';

export interface PersonaDef {
  id: PersonaId;
  displayName: string;
  description: string;
  priorityKpis: string[];
  toolWeights: Record<string, number>;
  briefCardWeights: Record<string, number>;
  suggestedStarterPrompts: string[];
  /** Defaults pre-filled when first selecting this persona (overridable). */
  preferenceDefaults?: Partial<{
    target_cap_rate: number;
    risk_level: 'low' | 'medium' | 'high';
  }>;
}

const firstTimeBuyer: PersonaDef = {
  id: 'first_time_buyer',
  displayName: 'First-Time Buyer',
  description:
    'Buying your first home. Focus on affordability, mortgage payments, neighborhood quality, and long-term appreciation.',
  priorityKpis: [
    'affordability index',
    'mortgage payment',
    'days on market',
    'appreciation',
    'school and crime trends',
  ],
  toolWeights: {
    compute_affordability_index: 1.0,
    compute_metrics: 0.9,
    get_market_stats: 0.9,
    get_neighborhood_quality: 0.9,
    compute_roi: 0.4,
    estimate_arv: 0.1,
    compute_flip_spread: 0.05,
    get_migration_trends: 0.4,
    get_employment_trends: 0.4,
    get_absorption_rate: 0.5,
    get_supply_pipeline: 0.2,
    list_listings: 0.8,
    compare_properties: 0.6,
    project_amortization: 0.6,
    compute_budget_affordability: 0.7,
    find_comparable_sales: 0.3,
    show_reduction_heatmap: 0.6,
  },
  briefCardWeights: {
    budget_vs_market: 1.0,
    cap_rate_trend: 0.2,
    watchlist_price_trend: 0.6,
    price_reduction_heatmap: 0.8,
    neighborhood_scores: 0.9,
    ranked_analyses: 0.5,
    missing_data: 0.3,
    setup: 1.0,
    sample: 1.0,
  },
  suggestedStarterPrompts: [
    'Can I afford a $500k home in Austin on $120k income?',
    "What would my mortgage payment be at today's rates?",
    'Show me schools and crime in 78704.',
  ],
  preferenceDefaults: { risk_level: 'low' },
};

const rentalInvestor: PersonaDef = {
  id: 'rental_investor',
  displayName: 'Rental Investor',
  description:
    'Buy-and-hold rentals. Focus on cap rate, cash flow, occupancy, rent growth, and operating costs.',
  priorityKpis: ['cap rate', 'cash flow', 'occupancy', 'rent growth', 'taxes and insurance'],
  toolWeights: {
    compute_metrics: 1.0,
    compute_roi: 0.9,
    get_market_stats: 0.9,
    list_listings: 0.9,
    compare_properties: 0.9,
    project_amortization: 0.7,
    compute_budget_affordability: 0.7,
    compute_affordability_index: 0.3,
    estimate_arv: 0.2,
    compute_flip_spread: 0.1,
    get_neighborhood_quality: 0.4,
    get_migration_trends: 0.5,
    get_employment_trends: 0.5,
    get_absorption_rate: 0.6,
    get_supply_pipeline: 0.4,
    find_comparable_sales: 0.5,
    show_reduction_heatmap: 0.8,
  },
  briefCardWeights: {
    cap_rate_trend: 1.0,
    watchlist_price_trend: 0.9,
    price_reduction_heatmap: 0.9,
    budget_vs_market: 0.7,
    ranked_analyses: 0.9,
    missing_data: 0.9,
    neighborhood_scores: 0.4,
    setup: 1.0,
    sample: 1.0,
  },
  suggestedStarterPrompts: [
    'Run the numbers on 1814 Cedar at my saved financing defaults.',
    'Compare cap rates across my memorized properties.',
    "What's the realistic rent for a 3-bed in 78704?",
  ],
  preferenceDefaults: { target_cap_rate: 0.07, risk_level: 'medium' },
};

const flipper: PersonaDef = {
  id: 'flipper',
  displayName: 'Flipper',
  description:
    'Buy, renovate, sell. Focus on ARV, renovation spread, days on market, and local appreciation.',
  priorityKpis: ['ARV', 'days on market', 'renovation spread', 'local appreciation'],
  toolWeights: {
    estimate_arv: 1.0,
    compute_flip_spread: 1.0,
    find_comparable_sales: 0.9,
    get_market_stats: 0.8,
    list_listings: 0.7,
    compute_metrics: 0.5,
    compute_roi: 0.3,
    compute_budget_affordability: 0.4,
    compute_affordability_index: 0.2,
    get_neighborhood_quality: 0.3,
    get_migration_trends: 0.3,
    get_employment_trends: 0.3,
    get_absorption_rate: 0.7,
    get_supply_pipeline: 0.3,
    project_amortization: 0.3,
    compare_properties: 0.6,
    show_reduction_heatmap: 1.0,
  },
  briefCardWeights: {
    price_reduction_heatmap: 1.0,
    ranked_analyses: 0.8,
    cap_rate_trend: 0.2,
    watchlist_price_trend: 0.6,
    flip_spread_movers: 0.9,
    budget_vs_market: 0.4,
    missing_data: 0.5,
    setup: 1.0,
    sample: 1.0,
  },
  suggestedStarterPrompts: [
    'ARV for a 3/2 1500sqft in 78745 after a $40k reno.',
    'Show me recent comps for 1814 Cedar.',
    'Flip spread on a $300k purchase with $45k reno.',
  ],
  preferenceDefaults: { risk_level: 'high' },
};

const institutional: PersonaDef = {
  id: 'institutional',
  displayName: 'Institutional Investor',
  description:
    'Portfolio and market-level moves. Focus on migration, employment, NOI, vacancy, absorption, and supply pipeline.',
  priorityKpis: [
    'migration',
    'employment growth',
    'NOI',
    'vacancy',
    'absorption rate',
    'permits and housing starts',
  ],
  toolWeights: {
    get_migration_trends: 1.0,
    get_employment_trends: 1.0,
    get_supply_pipeline: 1.0,
    get_absorption_rate: 1.0,
    get_market_stats: 0.9,
    compute_metrics: 0.8,
    compute_roi: 0.8,
    list_listings: 0.5,
    compare_properties: 0.7,
    estimate_arv: 0.3,
    compute_flip_spread: 0.2,
    get_neighborhood_quality: 0.4,
    compute_affordability_index: 0.2,
    project_amortization: 0.5,
    compute_budget_affordability: 0.4,
    find_comparable_sales: 0.4,
    show_reduction_heatmap: 0.7,
  },
  briefCardWeights: {
    migration_trends: 1.0,
    cap_rate_trend: 0.7,
    price_reduction_heatmap: 0.7,
    watchlist_price_trend: 0.5,
    ranked_analyses: 0.6,
    budget_vs_market: 0.3,
    missing_data: 0.6,
    setup: 1.0,
    sample: 1.0,
  },
  suggestedStarterPrompts: [
    'Migration and employment outlook for the Austin MSA.',
    'Supply pipeline for Tampa over the next 24 months.',
    'Absorption rate trend in Austin over 12 months.',
  ],
  preferenceDefaults: { target_cap_rate: 0.08, risk_level: 'low' },
};

function averageWeights(...defs: PersonaDef[]): Record<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const def of defs) {
    for (const [k, v] of Object.entries(def.toolWeights)) {
      const cur = sums.get(k) ?? { total: 0, count: 0 };
      sums.set(k, { total: cur.total + v, count: cur.count + 1 });
    }
  }
  const out: Record<string, number> = {};
  for (const [k, { total, count }] of sums) out[k] = Number((total / count).toFixed(2));
  return out;
}

function averageCardWeights(...defs: PersonaDef[]): Record<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const def of defs) {
    for (const [k, v] of Object.entries(def.briefCardWeights)) {
      const cur = sums.get(k) ?? { total: 0, count: 0 };
      sums.set(k, { total: cur.total + v, count: cur.count + 1 });
    }
  }
  const out: Record<string, number> = {};
  for (const [k, { total, count }] of sums) out[k] = Number((total / count).toFixed(2));
  return out;
}

const mixed: PersonaDef = {
  id: 'mixed',
  displayName: 'Mixed / not sure yet',
  description:
    "We'll show you a balanced mix and tune over time. You can switch to a specific persona any time.",
  priorityKpis: ['affordability', 'cap rate', 'cash flow', 'appreciation', 'market growth'],
  toolWeights: averageWeights(firstTimeBuyer, rentalInvestor, flipper, institutional),
  briefCardWeights: averageCardWeights(firstTimeBuyer, rentalInvestor, flipper, institutional),
  suggestedStarterPrompts: [
    'Show me an overview of my target market.',
    'What can I afford with my current preferences?',
    "Surprise me — what should I be looking at this week?",
  ],
};

export const PERSONAS: Record<PersonaId, PersonaDef> = {
  first_time_buyer: firstTimeBuyer,
  rental_investor: rentalInvestor,
  flipper,
  institutional,
  mixed,
};

export const PERSONA_ORDER: PersonaId[] = [
  'first_time_buyer',
  'rental_investor',
  'flipper',
  'institutional',
  'mixed',
];

export function getPersona(id: string | null | undefined): PersonaDef {
  if (id && id in PERSONAS) return PERSONAS[id as PersonaId];
  return PERSONAS.mixed;
}

/**
 * Blend a primary persona with up to two secondary personas at 70/30 weight.
 * Used by the brief composer and (optionally) the AI system prompt builder.
 */
export function blendedWeights(
  primary: PersonaId,
  secondary: PersonaId[] = [],
): { toolWeights: Record<string, number>; briefCardWeights: Record<string, number> } {
  const p = getPersona(primary);
  if (!secondary.length) return { toolWeights: p.toolWeights, briefCardWeights: p.briefCardWeights };
  const sec = secondary.map(getPersona);
  const secAvgTool = averageWeights(...sec);
  const secAvgCard = averageCardWeights(...sec);
  const blend = (a: Record<string, number>, b: Record<string, number>) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out: Record<string, number> = {};
    for (const k of keys) out[k] = Number((((a[k] ?? 0.5) * 0.7) + ((b[k] ?? 0.5) * 0.3)).toFixed(2));
    return out;
  };
  return {
    toolWeights: blend(p.toolWeights, secAvgTool),
    briefCardWeights: blend(p.briefCardWeights, secAvgCard),
  };
}