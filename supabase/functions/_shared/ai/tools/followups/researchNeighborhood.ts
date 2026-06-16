/**
 * research_neighborhood — Composite neighborhood lookup. One Perplexity call
 * returns schools, safety, commute, amenities, and 12-month price trend for
 * a city or ZIP. 7-day cache.
 */

import { cachedPerplexity } from './perplexityHelper.ts';

export const RESEARCH_NEIGHBORHOOD_TOOL = {
  type: 'function' as const,
  function: {
    name: 'research_neighborhood',
    description:
      'Pull a concise neighborhood snapshot (schools, safety, commute, amenities, recent price trend) for a US city, neighborhood, or ZIP. Use when the user asks "what is X like to live in", "is X safe", "schools in X", or wants neighborhood context.',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Neighborhood/city/ZIP (e.g. "East Austin, TX" or "78704"). REQUIRED.' },
        focus: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['schools', 'safety', 'commute', 'amenities', 'trend', 'demographics'],
          },
          description: 'Optional subset. Defaults to all five.',
        },
      },
      required: ['location'],
    },
  },
};

export interface ResearchNeighborhoodInput {
  location?: unknown;
  focus?: unknown;
}

const ALL_FOCI = ['schools', 'safety', 'commute', 'amenities', 'trend', 'demographics'] as const;

export async function runResearchNeighborhood(input: ResearchNeighborhoodInput) {
  const location = typeof input.location === 'string' ? input.location.trim().slice(0, 120) : '';
  if (!location) return { ok: false, answer: '', citations: [], error: 'location required' };

  const focusInput = Array.isArray(input.focus) ? input.focus : [];
  const foci = focusInput.filter((f): f is string => typeof f === 'string' && (ALL_FOCI as readonly string[]).includes(f));
  const useFoci = foci.length ? foci : ['schools', 'safety', 'commute', 'amenities', 'trend'];

  const sections = useFoci.map((f) => {
    switch (f) {
      case 'schools': return '- Schools: top-rated public schools (GreatSchools rating), district name';
      case 'safety': return '- Safety: crime index vs national avg, notable trends';
      case 'commute': return '- Commute: typical drive time to nearest major employment center, transit availability';
      case 'amenities': return '- Amenities: parks, grocery, dining, walkability score';
      case 'trend': return '- Price trend: median home price now vs 12 months ago, YoY % change, days on market';
      case 'demographics': return '- Demographics: median age, household income, owner vs renter mix';
      default: return '';
    }
  }).filter(Boolean).join('\n');

  const prompt = `Neighborhood snapshot for ${location}. Return tight bullet points covering:
${sections}

Use the most recent verifiable data. Cite specific numbers where possible. Under 300 words total.`;

  return cachedPerplexity({
    cacheKey: `nbhd_${location}_${useFoci.sort().join('-')}`,
    source: 'followup_neighborhood',
    ttlMinutes: 60 * 24 * 7, // 7 days
    prompt,
    system:
      'You are a US neighborhood research backend. Prefer GreatSchools, Niche, Census, Redfin, Zillow data. Numbers only, no marketing language.',
    recency: 'month',
    maxTokens: 700,
  });
}