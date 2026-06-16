/**
 * test_buying_ability — Quick affordability check. Combines the deterministic
 * mortgage math from `_shared/calcEngine.ts` (PI payment, DTI) with a live
 * 30-year fixed rate fetched from Perplexity (24h cache). Returns a structured
 * payload Sonnet can summarize without re-computing math.
 */

import { monthlyMortgagePayment } from '../../../calcEngine.ts';
import { cachedPerplexity } from './perplexityHelper.ts';

export const TEST_BUYING_ABILITY_TOOL = {
  type: 'function' as const,
  function: {
    name: 'test_buying_ability',
    description:
      'Estimate how much home a user can afford given income, down payment, and target market. Returns max purchase price at 36% DTI plus a stretch number at 43% DTI, using a live 30y rate. Use when the user asks "can I afford X" or "what can I buy with Y income".',
    parameters: {
      type: 'object',
      properties: {
        annualIncome: { type: 'number', description: 'Gross annual household income in USD. REQUIRED.' },
        downPayment: { type: 'number', description: 'Cash available for down payment in USD. REQUIRED.' },
        monthlyDebts: { type: 'number', description: 'Existing monthly debt obligations (car, student loans, CC mins).' },
        location: { type: 'string', description: 'Target market for rate lookup (e.g. "Austin, TX").' },
        propertyTaxRate: { type: 'number', description: 'Optional. Effective property tax rate (e.g. 0.018). Defaults to 1.2%.' },
      },
      required: ['annualIncome', 'downPayment'],
    },
  },
};

export interface TestBuyingAbilityInput {
  annualIncome?: unknown;
  downPayment?: unknown;
  monthlyDebts?: unknown;
  location?: unknown;
  propertyTaxRate?: unknown;
}

function parseNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function fetchCurrent30yRate(location: string): Promise<{ rate: number; source: 'perplexity' | 'fallback' }> {
  const res = await cachedPerplexity({
    cacheKey: `rate_30y_${location || 'us'}`,
    source: 'followup_rate30y',
    ttlMinutes: 60 * 24,
    prompt: `What is the current average US 30-year fixed mortgage rate this week${location ? ` for borrowers in ${location}` : ''}? Reply with ONLY a JSON object: {"rate_pct": <number>, "as_of": "<date>"}. No prose.`,
    system: 'You are a rates lookup backend. Respond with valid JSON only.',
    recency: 'week',
    maxTokens: 120,
  });
  if (res.ok) {
    const match = res.answer.match(/\{[\s\S]*?\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        const rate = Number(parsed.rate_pct);
        if (Number.isFinite(rate) && rate > 1 && rate < 15) {
          return { rate: rate / 100, source: 'perplexity' };
        }
      } catch {
        // fall through
      }
    }
  }
  return { rate: 0.07, source: 'fallback' };
}

function solveMaxPrice(
  maxMonthlyPI: number,
  rateApr: number,
  downPayment: number,
  taxRate: number,
  insAnnualPctOfPrice = 0.005,
): number {
  // PITI cap = maxMonthlyPI. Iterate prices to find the largest one where
  // PI(loan(price)) + taxes(price)/12 + ins(price)/12 <= cap. Cheap binary search.
  let lo = downPayment;
  let hi = downPayment + 5_000_000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const loan = Math.max(0, mid - downPayment);
    const pi = monthlyMortgagePayment(loan, rateApr, 30);
    const tax = (mid * taxRate) / 12;
    const ins = (mid * insAnnualPctOfPrice) / 12;
    const total = pi + tax + ins;
    if (total > maxMonthlyPI) hi = mid;
    else lo = mid;
  }
  return Math.round(lo / 1000) * 1000;
}

export async function runTestBuyingAbility(input: TestBuyingAbilityInput) {
  const annualIncome = parseNum(input.annualIncome);
  const downPayment = parseNum(input.downPayment);
  if (annualIncome <= 0 || downPayment < 0) {
    return { ok: false, error: 'annualIncome and downPayment required' };
  }
  const monthlyDebts = parseNum(input.monthlyDebts);
  const location = typeof input.location === 'string' ? input.location.trim().slice(0, 120) : '';
  const taxRate = parseNum(input.propertyTaxRate, 0.012) || 0.012;

  const { rate, source } = await fetchCurrent30yRate(location);

  const monthlyIncome = annualIncome / 12;
  // Conservative DTI 36% incl. all debts, stretch DTI 43%.
  const conservativeHousing = Math.max(0, monthlyIncome * 0.36 - monthlyDebts);
  const stretchHousing = Math.max(0, monthlyIncome * 0.43 - monthlyDebts);

  const conservativeMax = solveMaxPrice(conservativeHousing, rate, downPayment, taxRate);
  const stretchMax = solveMaxPrice(stretchHousing, rate, downPayment, taxRate);

  return {
    ok: true,
    inputs: { annualIncome, downPayment, monthlyDebts, location: location || null, taxRate },
    rate: { aprPct: +(rate * 100).toFixed(3), source },
    conservative: {
      dtiPct: 36,
      maxHousingPayment: Math.round(conservativeHousing),
      maxPurchasePrice: conservativeMax,
    },
    stretch: {
      dtiPct: 43,
      maxHousingPayment: Math.round(stretchHousing),
      maxPurchasePrice: stretchMax,
    },
    note:
      'Estimates assume 30y fixed, taxes at given rate, insurance ~0.5% of price/yr, no HOA, no PMI adjustment beyond down payment. Lender pre-approval will refine.',
  };
}