/**
 * compare_properties — Side-by-side comparison of 2-3 properties the user
 * has already analyzed in the session. Pure computation, no external call —
 * Sonnet supplies the candidate properties via the conversation context.
 */

export const COMPARE_PROPERTIES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'compare_properties',
    description:
      'Build a side-by-side comparison of 2 or 3 properties the user is weighing. Pass the property snapshots already discussed in the conversation. Returns a structured comparison table with per-metric winners.',
    parameters: {
      type: 'object',
      properties: {
        properties: {
          type: 'array',
          minItems: 2,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Short label (address or nickname).' },
              price: { type: 'number' },
              beds: { type: 'number' },
              baths: { type: 'number' },
              sqft: { type: 'number' },
              yearBuilt: { type: 'number' },
              hoaMonthly: { type: 'number' },
              propertyTaxYearly: { type: 'number' },
              estimatedRentMonthly: { type: 'number' },
              matchScore: { type: 'number', description: '0-100 if available.' },
            },
            required: ['label', 'price'],
          },
        },
        focus: {
          type: 'string',
          enum: ['value', 'cash_flow', 'lifestyle', 'overall'],
          description: 'Optional comparison lens.',
        },
      },
      required: ['properties'],
    },
  },
};

interface PropInput {
  label: string;
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  hoaMonthly?: number;
  propertyTaxYearly?: number;
  estimatedRentMonthly?: number;
  matchScore?: number;
}

export interface CompareInput {
  properties?: unknown;
  focus?: unknown;
}

function coerceProp(p: unknown): PropInput | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label.slice(0, 80) : '';
  const price = Number(o.price);
  if (!label || !Number.isFinite(price) || price <= 0) return null;
  const num = (k: string): number | undefined => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    label,
    price,
    beds: num('beds'),
    baths: num('baths'),
    sqft: num('sqft'),
    yearBuilt: num('yearBuilt'),
    hoaMonthly: num('hoaMonthly'),
    propertyTaxYearly: num('propertyTaxYearly'),
    estimatedRentMonthly: num('estimatedRentMonthly'),
    matchScore: num('matchScore'),
  };
}

export function runCompareProperties(input: CompareInput) {
  const arr = Array.isArray(input.properties) ? input.properties : [];
  const props = arr.map(coerceProp).filter((p): p is PropInput => !!p);
  if (props.length < 2) return { ok: false, error: 'Need at least 2 properties.' };
  if (props.length > 3) props.length = 3;
  const focus = ['value', 'cash_flow', 'lifestyle', 'overall'].includes(String(input.focus))
    ? String(input.focus)
    : 'overall';

  const rows = props.map((p) => {
    const pricePerSqft = p.sqft && p.sqft > 0 ? p.price / p.sqft : null;
    const grossRentMultiplier = p.estimatedRentMonthly && p.estimatedRentMonthly > 0
      ? p.price / (p.estimatedRentMonthly * 12)
      : null;
    const rentToPriceMonthly = p.estimatedRentMonthly && p.price > 0
      ? p.estimatedRentMonthly / p.price
      : null;
    const totalMonthlyCarry =
      (p.propertyTaxYearly ?? 0) / 12 + (p.hoaMonthly ?? 0);
    return {
      label: p.label,
      price: p.price,
      beds: p.beds ?? null,
      baths: p.baths ?? null,
      sqft: p.sqft ?? null,
      yearBuilt: p.yearBuilt ?? null,
      pricePerSqft: pricePerSqft != null ? Math.round(pricePerSqft) : null,
      hoaMonthly: p.hoaMonthly ?? null,
      propertyTaxYearly: p.propertyTaxYearly ?? null,
      monthlyCarry: Math.round(totalMonthlyCarry),
      estimatedRentMonthly: p.estimatedRentMonthly ?? null,
      grossRentMultiplier: grossRentMultiplier != null ? +grossRentMultiplier.toFixed(1) : null,
      onePctRuleHit: rentToPriceMonthly != null ? rentToPriceMonthly >= 0.01 : null,
      matchScore: p.matchScore ?? null,
    };
  });

  // Winner per metric (lower is better for price/sqft, GRM, carry; higher better for matchScore, rent, sqft).
  const winners: Record<string, string | null> = {};
  const argMin = (key: keyof (typeof rows)[number]) => {
    let best: string | null = null;
    let bestVal = Infinity;
    for (const r of rows) {
      const v = r[key] as number | null;
      if (typeof v === 'number' && v < bestVal) {
        bestVal = v;
        best = r.label;
      }
    }
    return best;
  };
  const argMax = (key: keyof (typeof rows)[number]) => {
    let best: string | null = null;
    let bestVal = -Infinity;
    for (const r of rows) {
      const v = r[key] as number | null;
      if (typeof v === 'number' && v > bestVal) {
        bestVal = v;
        best = r.label;
      }
    }
    return best;
  };
  winners.cheapest = argMin('price');
  winners.bestPricePerSqft = argMin('pricePerSqft');
  winners.lowestCarry = argMin('monthlyCarry');
  winners.bestRentYield = argMin('grossRentMultiplier');
  winners.bestMatch = argMax('matchScore');
  winners.mostSpace = argMax('sqft');

  return { ok: true, focus, rows, winners };
}