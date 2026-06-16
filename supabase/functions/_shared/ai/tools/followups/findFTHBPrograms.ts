/**
 * find_fthb_programs — Surfaces state/local first-time homebuyer assistance
 * programs (down payment assistance, MCC credits, grants). Perplexity with
 * a HUD / .gov / state housing finance agency bias. 7-day cache.
 */

import { cachedPerplexity } from './perplexityHelper.ts';

export const FIND_FTHB_PROGRAMS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'find_fthb_programs',
    description:
      'Return active first-time homebuyer assistance programs (down payment help, closing cost grants, MCC tax credits, state HFA loans) for a given US state or metro. Use when the user mentions first-time buyer status, low down payment, or asks about grants/assistance.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'State or city, state (e.g. "Texas" or "Austin, TX"). REQUIRED.',
        },
        householdIncome: {
          type: 'number',
          description: 'Optional. Annual household income in USD — used to filter income-capped programs.',
        },
      },
      required: ['location'],
    },
  },
};

export interface FindFTHBProgramsInput {
  location?: unknown;
  householdIncome?: unknown;
}

export async function runFindFTHBPrograms(input: FindFTHBProgramsInput) {
  const location = typeof input.location === 'string' ? input.location.trim().slice(0, 120) : '';
  if (!location) {
    return { ok: false, answer: '', citations: [], error: 'location required' };
  }
  const income = typeof input.householdIncome === 'number' && input.householdIncome > 0
    ? Math.round(input.householdIncome)
    : null;

  const incomeLine = income ? `\n\nHousehold income: ~$${income.toLocaleString()}. Flag any program where this exceeds the cap.` : '';

  const prompt = `List the 3-6 most useful first-time homebuyer assistance programs currently available in ${location}. Include:
- Program name & administering agency (state HFA, city, HUD, etc.)
- What it provides (e.g. "$15k forgivable DPA", "MCC up to $2k/yr tax credit", "below-market 30y fixed")
- Key eligibility (income cap, purchase price cap, first-time definition, occupancy)
- How to apply (1 line)

Only programs actively accepting applications. Skip expired or paused programs.${incomeLine}`;

  return cachedPerplexity({
    cacheKey: `fthb_${location}${income ? `_inc${Math.round(income / 1000)}k` : ''}`,
    source: 'followup_fthb',
    ttlMinutes: 60 * 24 * 7, // 7 days
    prompt,
    system:
      'You are a US housing assistance research backend. Prefer .gov and state HFA sources. Only list programs that are verifiably active.',
    recency: 'year',
    domainFilter: ['hud.gov', '.gov', 'nahb.org', 'consumerfinance.gov'],
    maxTokens: 700,
  });
}