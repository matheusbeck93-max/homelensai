/**
 * Open-house intent detection + early-intercept formatter.
 *
 * Used by chat surfaces that don't run a structured tool loop
 * (property-assistant, owned-property-chat, perplexity-chat,
 * extension-followups, preferences-chat). They call
 * `detectOpenHouseIntent` on the latest user message; if it returns
 * a payload, the surface should call `runOpenHouseLookup` and either
 * return the markdown directly or prepend it to the AI context.
 */

import { executeFindOpenHouses, type FindOpenHousesArgs } from './tool.ts';
import type { UiBlockCard } from './formatCards.ts';

const OPEN_HOUSE_PATTERNS = [
  /\bopen\s*house(s)?\b/i,
  /\bopen\s+(this|next)?\s*(saturday|sunday|weekend|sat|sun)\b/i,
  /\btour\s+(this|next)\s+(weekend|saturday|sunday)\b/i,
  /\bvisiting\s+(homes|houses|properties)\s+(this|next)\s+weekend\b/i,
];

const US_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);
const CA_PROV_CODES = new Set(['ON','QC','BC','AB','MB','SK','NS','NB','NL','PE']);

export interface OpenHouseIntent {
  matched: true;
  args: FindOpenHousesArgs;
}

/**
 * Returns an intent payload if the message references open houses,
 * else null. Best-effort regex parsing — the AI tool path is preferred
 * for ai-chat / investor-chat which have proper function calling.
 */
export function detectOpenHouseIntent(message: string): OpenHouseIntent | null {
  if (!message) return null;
  const matched = OPEN_HOUSE_PATTERNS.some((re) => re.test(message));
  if (!matched) return null;

  const args: FindOpenHousesArgs = { country: 'US' };

  // Country
  if (/\bcanada|toronto|vancouver|montreal|ontario|quebec|alberta|british columbia\b/i.test(message)) {
    args.country = 'CA';
  }

  // State/province (look for ", XX" or " in XX" with 2-letter code)
  const codeMatch = message.match(/\b([A-Z]{2})\b/);
  if (codeMatch) {
    const code = codeMatch[1];
    if (US_STATE_CODES.has(code)) {
      args.state = code;
      args.country = 'US';
    } else if (CA_PROV_CODES.has(code)) {
      args.state = code;
      args.country = 'CA';
    }
  }

  // City: simple "in <City>" or "in <City>, ST"
  const cityMatch = message.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)(?:,\s*([A-Z]{2}))?/);
  if (cityMatch) {
    args.city = cityMatch[1];
    if (cityMatch[2]) {
      const code = cityMatch[2];
      if (US_STATE_CODES.has(code)) { args.state = code; args.country = 'US'; }
      else if (CA_PROV_CODES.has(code)) { args.state = code; args.country = 'CA'; }
    }
  }

  // Date range: "this weekend" / "next weekend"
  const today = new Date();
  const dow = today.getDay();
  if (/\bthis\s+weekend|this\s+sat(urday)?|this\s+sun(day)?\b/i.test(message)) {
    const sat = new Date(today);
    sat.setDate(today.getDate() + ((6 - dow + 7) % 7));
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    args.dateFrom = sat.toISOString().slice(0, 10);
    args.dateTo = sun.toISOString().slice(0, 10);
  } else if (/\bnext\s+weekend\b/i.test(message)) {
    const sat = new Date(today);
    sat.setDate(today.getDate() + ((6 - dow + 7) % 7) + 7);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    args.dateFrom = sat.toISOString().slice(0, 10);
    args.dateTo = sun.toISOString().slice(0, 10);
  }

  // Price ceiling: "under $800k", "below 1.2M"
  const priceMatch = message.match(/\b(?:under|below|up to|max(?:imum)?)\s*\$?\s*(\d+(?:\.\d+)?)\s*(k|m)?/i);
  if (priceMatch) {
    let n = parseFloat(priceMatch[1]);
    const unit = priceMatch[2]?.toLowerCase();
    if (unit === 'k') n *= 1_000;
    else if (unit === 'm') n *= 1_000_000;
    else if (n < 100) n *= 1_000_000; // "under 1.2"
    args.priceMax = Math.round(n);
  }

  return { matched: true, args };
}

export interface OpenHouseLookupResult {
  markdown: string;
  cards: UiBlockCard[];
  count: number;
}

/**
 * Execute the open-house search and format a markdown summary suitable
 * for chat surfaces that render markdown (perplexity-chat,
 * property-assistant, owned-property-chat, preferences-chat,
 * extension-followups). Cards are returned separately for surfaces that
 * want to render them as rich UI.
 */
export async function runOpenHouseLookup(
  args: FindOpenHousesArgs,
  authHeader: string | null,
): Promise<OpenHouseLookupResult> {
  const result = await executeFindOpenHouses(args, authHeader);
  if (!result.ok || result.cards.length === 0) {
    return { markdown: result.message, cards: [], count: 0 };
  }
  const lines: string[] = [`**${result.message}**`, ''];
  for (const c of result.cards.slice(0, 8)) {
    const price = `$${Math.round(c.price).toLocaleString()}`;
    lines.push(
      `- [${c.address}, ${c.cityState}](${c.listingUrl}) — ${price} · ${c.beds}bd/${c.baths}ba · ${c.openHouseLabel} *(${c.source})*`,
    );
  }
  return { markdown: lines.join('\n'), cards: result.cards, count: result.cards.length };
}