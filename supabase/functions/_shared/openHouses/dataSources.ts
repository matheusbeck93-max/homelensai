/**
 * Open-house data sources: Perplexity (primary) + Firecrawl (fallback).
 *
 * Why: direct Redfin/Realtor scrapes get bot-blocked or return empty
 * pages. Perplexity has its own indexing/scraping and reliably surfaces
 * upcoming open-house pages with citations. We use Gemini (Lovable AI
 * Gateway, no extra key) to extract structured listings from its prose.
 * Firecrawl is kept as a fallback for thin Perplexity responses.
 */

import { createLogger } from '../logging.ts';
import { requireEnv } from '../env.ts';
import type { OpenHouseListing } from './types.ts';
import type { FindOpenHousesArgs } from './tool.ts';

const log = createLogger('open-houses:dataSources');
const MAX_LISTINGS = 25;

/* -------------------------------------------------------------------------- */
/* Loose listing shape — post-validated, not Zod-enforced.                    */
/* -------------------------------------------------------------------------- */

interface LooseListing {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  lat?: number;
  lng?: number;
  photo?: string;
  listingUrl?: string;
  openHouseStart?: string;
  openHouseEnd?: string;
  source?: string;
  confidence?: 'high' | 'medium' | 'low';
}

function isValidListing(l: LooseListing): boolean {
  if (!l.address || !l.openHouseStart) return false;
  // Drop low-confidence rows missing core economic fields.
  if (l.confidence === 'low' && (!l.price || !l.beds)) return false;
  return true;
}

function inferSource(url: string | undefined, hint: string | undefined): OpenHouseListing['source'] {
  const u = (url || '').toLowerCase();
  if (u.includes('redfin')) return 'redfin';
  if (u.includes('realtor')) return 'realtor';
  if (hint?.toLowerCase().includes('redfin')) return 'redfin';
  if (hint?.toLowerCase().includes('realtor')) return 'realtor';
  return 'cache';
}

function normalize(
  raw: LooseListing[],
  country: 'US' | 'CA',
): OpenHouseListing[] {
  const out: OpenHouseListing[] = [];
  for (const r of raw) {
    if (!isValidListing(r)) continue;
    const src = inferSource(r.listingUrl, r.source);
    const id = `${src}-${(r.listingUrl || r.address || '').slice(0, 80)}`;
    out.push({
      id,
      address: r.address!,
      city: r.city ?? '',
      state: r.state ?? '',
      zip: r.zip ?? null,
      country,
      price: Number(r.price ?? 0),
      beds: Number(r.beds ?? 0),
      baths: Number(r.baths ?? 0),
      sqft: r.sqft ?? null,
      lat: r.lat ?? null,
      lng: r.lng ?? null,
      photo: r.photo ?? null,
      listingUrl: r.listingUrl ?? '',
      source: src,
      openHouses: r.openHouseStart
        ? [{
            start: r.openHouseStart,
            end: r.openHouseEnd || r.openHouseStart,
            type: 'in-person',
          }]
        : [],
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Perplexity primary                                                         */
/* -------------------------------------------------------------------------- */

function buildPerplexityQuery(f: FindOpenHousesArgs): string {
  const where = [f.city, f.state].filter(Boolean).join(', ') || 'major US metros';
  const dateClause = f.dateFrom && f.dateTo
    ? `between ${f.dateFrom} and ${f.dateTo}`
    : f.dateFrom
      ? `on or after ${f.dateFrom}`
      : 'this weekend';
  const priceClause = [
    f.priceMin ? `at least $${f.priceMin.toLocaleString()}` : '',
    f.priceMax ? `under $${f.priceMax.toLocaleString()}` : '',
  ].filter(Boolean).join(' and ');
  return [
    `List upcoming in-person open houses in ${where} ${dateClause}.`,
    priceClause ? `Filter to homes priced ${priceClause}.` : '',
    'For each home, give: full street address, city, state, ZIP, asking price (number), bedrooms, bathrooms, square footage, open house date and start/end time (local), photo URL if available, and the source listing URL on Zillow, Realtor.com, or Redfin.',
    'Prefer results from Zillow, Redfin, and Realtor.com. Include at least 10 if available.',
  ].filter(Boolean).join(' ');
}

interface PerplexityResponse {
  answer: string;
  citations: string[];
}

async function callPerplexity(query: string): Promise<PerplexityResponse | null> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) {
    log.warn('PERPLEXITY_API_KEY missing — skipping Perplexity');
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'sonar',
        search_recency_filter: 'week',
        messages: [
          {
            role: 'system',
            content: 'You are a real-estate research backend. Return a tight factual listing-by-listing answer. No greetings. Include every requested data field per home.',
          },
          { role: 'user', content: query },
        ],
      }),
    });
    if (!res.ok) {
      log.warn('Perplexity non-200', { status: res.status });
      return null;
    }
    const data = await res.json();
    const answer: string = data?.choices?.[0]?.message?.content ?? '';
    const citations: string[] = Array.isArray(data?.citations) ? data.citations : [];
    return { answer, citations };
  } catch (err) {
    log.warn('Perplexity call failed', { err: (err as Error).message });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const EXTRACTION_SYSTEM = `You extract structured open-house listings from web research text.
Return ONLY valid JSON matching this shape (no markdown, no commentary):
{"listings":[{"address":"","city":"","state":"","zip":"","price":0,"beds":0,"baths":0,"sqft":0,"openHouseStart":"ISO8601","openHouseEnd":"ISO8601","listingUrl":"","photo":"","source":"Zillow|Redfin|Realtor","confidence":"high|medium|low"}]}
Rules:
- If a date is given relative ("this Saturday"), resolve to a full ISO8601 datetime using the current year and the user's stated date window.
- Omit a listing only if neither address nor any date can be determined.
- confidence = "high" when address + date + price + beds are all present; "medium" if 2-3 of those; "low" otherwise.
- Never invent prices or addresses. Use null/omit when unknown.`;

async function extractWithGemini(prose: string, citations: string[]): Promise<LooseListing[]> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    log.warn('LOVABLE_API_KEY missing — cannot extract listings');
    return [];
  }
  const today = new Date().toISOString().slice(0, 10);
  const userContent = `Today is ${today}.\n\nResearch:\n${prose}\n\nSources:\n${citations.slice(0, 12).join('\n')}`;

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!res.ok) {
    log.warn('Gemini extraction non-200', { status: res.status });
    return [];
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed?.listings) ? parsed.listings : [];
    return arr as LooseListing[];
  } catch (err) {
    log.warn('Gemini extraction JSON parse failed', { err: (err as Error).message, preview: text.slice(0, 200) });
    return [];
  }
}

export async function searchOpenHousesViaPerplexity(
  filters: FindOpenHousesArgs,
): Promise<OpenHouseListing[]> {
  const query = buildPerplexityQuery(filters);
  const pplx = await callPerplexity(query);
  if (!pplx || !pplx.answer.trim()) return [];
  const raw = await extractWithGemini(pplx.answer, pplx.citations);
  log.info('perplexity extraction', { raw_count: raw.length });
  return normalize(raw, filters.country);
}

/* -------------------------------------------------------------------------- */
/* Firecrawl fallback (existing logic, lifted from index.ts)                  */
/* -------------------------------------------------------------------------- */

function slugifyCity(city: string): string {
  return city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildRedfinUrl(f: FindOpenHousesArgs): string | null {
  if (!f.city || !f.state) return null;
  const citySlug = slugifyCity(f.city);
  const path = `${f.state.toUpperCase()}/${citySlug}/filter/include=open-house`;
  const filters: string[] = [];
  if (f.priceMin) filters.push(`min-price=${f.priceMin}`);
  if (f.priceMax) filters.push(`max-price=${f.priceMax}`);
  const filterTail = filters.length ? `,${filters.join(',')}` : '';
  return `https://www.redfin.com/city/${path}${filterTail}`;
}

function buildRealtorUrl(f: FindOpenHousesArgs): string | null {
  if (!f.city || !f.state) return null;
  const citySlug = slugifyCity(f.city);
  const base = `https://www.realtor.com/realestateandhomes-search/${citySlug}_${f.state.toUpperCase()}/show-open-house-only`;
  const params: string[] = [];
  if (f.priceMin) params.push(`price-${f.priceMin}-na`);
  if (f.priceMax) params.push(`price-na-${f.priceMax}`);
  return params.length ? `${base}/${params.join('/')}` : base;
}

const FIRECRAWL_SCHEMA = {
  type: 'object',
  properties: {
    listings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          zip: { type: 'string' },
          price: { type: 'number' },
          beds: { type: 'number' },
          baths: { type: 'number' },
          sqft: { type: 'number' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          photo: { type: 'string' },
          listingUrl: { type: 'string' },
          openHouseStart: { type: 'string' },
          openHouseEnd: { type: 'string' },
        },
      },
    },
  },
};

async function callFirecrawl(url: string, apiKey: string): Promise<LooseListing[]> {
  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      formats: [{ type: 'json', schema: FIRECRAWL_SCHEMA, prompt: 'Extract all listings with upcoming open houses on this page. Return an array.' }],
      onlyMainContent: true,
      waitFor: 4000,
    }),
  });
  if (!res.ok) {
    log.warn('Firecrawl non-200', { status: res.status });
    return [];
  }
  const data = await res.json();
  const json = data?.data?.json ?? data?.json ?? null;
  return Array.isArray(json?.listings) ? (json.listings as LooseListing[]) : [];
}

export async function searchOpenHousesViaFirecrawl(
  filters: FindOpenHousesArgs,
): Promise<OpenHouseListing[]> {
  const key = Deno.env.get('FIRECRAWL_API_KEY');
  if (!key) return [];
  const redfin = buildRedfinUrl(filters);
  const realtor = buildRealtorUrl(filters);
  let raw: LooseListing[] = [];
  if (redfin) raw = await callFirecrawl(redfin, key);
  if (raw.length === 0 && realtor) raw = await callFirecrawl(realtor, key);
  log.info('firecrawl extraction', { raw_count: raw.length });
  return normalize(raw, filters.country);
}

/* -------------------------------------------------------------------------- */
/* Orchestrator                                                                */
/* -------------------------------------------------------------------------- */

function dedup(a: OpenHouseListing[], b: OpenHouseListing[]): OpenHouseListing[] {
  const seen = new Set<string>();
  const out: OpenHouseListing[] = [];
  for (const l of [...a, ...b]) {
    const key = (l.listingUrl || '').split('?')[0].toLowerCase() || l.address.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out.slice(0, MAX_LISTINGS);
}

export interface OrchestratorResult {
  listings: OpenHouseListing[];
  primarySource: 'perplexity' | 'firecrawl' | 'none';
  perplexityCount: number;
  firecrawlCount: number;
}

export async function searchOpenHousesOrchestrated(
  filters: FindOpenHousesArgs,
): Promise<OrchestratorResult> {
  let perplexityListings: OpenHouseListing[] = [];
  let firecrawlListings: OpenHouseListing[] = [];

  try {
    perplexityListings = await searchOpenHousesViaPerplexity(filters);
  } catch (err) {
    log.warn('Perplexity path threw', { err: (err as Error).message });
  }

  // Fall back / supplement if Perplexity yielded thin results.
  if (perplexityListings.length < 3) {
    try {
      firecrawlListings = await searchOpenHousesViaFirecrawl(filters);
    } catch (err) {
      log.warn('Firecrawl path threw', { err: (err as Error).message });
    }
  }

  const merged = dedup(perplexityListings, firecrawlListings);
  const primarySource: OrchestratorResult['primarySource'] =
    perplexityListings.length > 0 ? 'perplexity' :
    firecrawlListings.length > 0 ? 'firecrawl' :
    'none';

  return {
    listings: merged,
    primarySource,
    perplexityCount: perplexityListings.length,
    firecrawlCount: firecrawlListings.length,
  };
}

export { MAX_LISTINGS };
// Silence unused-import warnings in callers that only want the env helper.
export const _requireEnv = requireEnv;