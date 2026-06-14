/**
 * Shared tool definition for `find_open_houses` reused by every chat
 * surface (ai-chat, investor-chat, property-assistant, owned-property-chat,
 * preferences-chat, perplexity-chat, extension-followups).
 *
 * The tool description is intentionally short — chat surfaces include the
 * Zod schema as JSON Schema in their tool registries and call
 * `executeFindOpenHouses` with the validated args.
 */

import { z } from 'https://esm.sh/zod@3.23.8';
import { searchOpenHouses } from './searchClient.ts';
import { formatListingsAsCards, type UiBlockCard } from './formatCards.ts';
import type { OpenHouseSearchResult } from './types.ts';

export const findOpenHousesSchema = z.object({
  country: z.enum(['US', 'CA']).default('US'),
  state: z.string().min(1).max(40).optional(),
  city: z.string().min(1).max(80).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priceMin: z.number().int().positive().optional(),
  priceMax: z.number().int().positive().optional(),
});

export type FindOpenHousesArgs = z.infer<typeof findOpenHousesSchema>;

export const findOpenHousesTool = {
  type: 'function' as const,
  function: {
    name: 'find_open_houses',
    description:
      'Find upcoming in-person open houses (US/Canada) by city, state, date range, and price range. Returns listing cards with address, price, and open-house time. Use when the user asks about "open houses", "open house this weekend", "tour", "open this Saturday", or similar.',
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', enum: ['US', 'CA'], description: 'Country code (defaults to US).' },
        state: { type: 'string', description: 'Two-letter state/province (e.g. CA, TX, ON).' },
        city: { type: 'string', description: 'City name (e.g. Austin, Toronto).' },
        dateFrom: { type: 'string', description: 'YYYY-MM-DD start date.' },
        dateTo: { type: 'string', description: 'YYYY-MM-DD end date.' },
        priceMin: { type: 'number', description: 'Minimum price in USD/CAD.' },
        priceMax: { type: 'number', description: 'Maximum price in USD/CAD.' },
      },
      required: [],
    },
  },
};

export interface FindOpenHousesToolResult {
  ok: boolean;
  message: string;
  cards: UiBlockCard[];
  result?: OpenHouseSearchResult;
  error?: string;
}

/**
 * Executes the tool: validates input, calls open-houses-search, formats cards.
 * The auth header is passed through so the edge function can enforce tier gating.
 */
export async function executeFindOpenHouses(
  rawArgs: unknown,
  authHeader: string | null,
): Promise<FindOpenHousesToolResult> {
  const parsed = findOpenHousesSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Could not parse open-house search filters.',
      cards: [],
      error: parsed.error.message,
    };
  }

  try {
    const result = await searchOpenHouses(parsed.data, authHeader);
    if (result.listings.length === 0) {
      return {
        ok: true,
        message: `No upcoming open houses found for the requested filters${parsed.data.city ? ` in ${parsed.data.city}` : ''}. Try widening the date range or area.`,
        cards: [],
        result,
      };
    }
    return {
      ok: true,
      message: `Found ${result.listings.length} open house${result.listings.length === 1 ? '' : 's'}${parsed.data.city ? ` in ${parsed.data.city}` : ''}.`,
      cards: formatListingsAsCards(result.listings),
      result,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: 'Open-house lookup failed. Please try again in a moment.',
      cards: [],
      error: msg,
    };
  }
}
