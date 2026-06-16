/**
 * find_local_lenders — Surfaces 3-5 reputable lenders/brokers active in a
 * user's target metro. Perplexity-grounded, 24h cache.
 */

import { cachedPerplexity } from './perplexityHelper.ts';

export const FIND_LOCAL_LENDERS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'find_local_lenders',
    description:
      'Return 3-5 reputable mortgage lenders or loan officers active in a US metro. Use when the user asks for lender recommendations, who to talk to about a mortgage, or where to get pre-approved.',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City, state (e.g. "Austin, TX"). REQUIRED.' },
        loanType: {
          type: 'string',
          enum: ['conventional', 'fha', 'va', 'jumbo', 'first_time_buyer', 'investor'],
          description: 'Optional. Steers the lender list toward a specific program.',
        },
      },
      required: ['location'],
    },
  },
};

export interface FindLocalLendersInput {
  location?: unknown;
  loanType?: unknown;
}

export async function runFindLocalLenders(input: FindLocalLendersInput) {
  const location = typeof input.location === 'string' ? input.location.trim().slice(0, 120) : '';
  if (!location) {
    return { ok: false, answer: '', citations: [], error: 'location required' };
  }
  const validLoan = ['conventional', 'fha', 'va', 'jumbo', 'first_time_buyer', 'investor'];
  const loanType = validLoan.includes(String(input.loanType)) ? String(input.loanType) : 'conventional';

  const prompt = `List 3-5 well-reviewed mortgage lenders, brokers, or loan officers actively originating ${loanType.replace('_', ' ')} loans in ${location}. For each provide:
- Company / loan officer name
- One-line specialty (e.g. "FHA & first-time buyer expert", "investor DSCR loans")
- Why they are credible (BBB rating, Zillow reviews, NMLS years, local reputation)

Prefer non-bank brokers and credit unions in addition to big banks when relevant. Avoid lead-gen aggregators. Skip any lender with significant CFPB complaints in the last 2 years.`;

  return cachedPerplexity({
    cacheKey: `lenders_${location}_${loanType}`,
    source: 'followup_lenders',
    ttlMinutes: 60 * 24,
    prompt,
    system:
      'You are a US mortgage research backend. Return concrete, verifiable lender names — no generic advice. Under 250 words.',
    recency: 'year',
    maxTokens: 600,
  });
}