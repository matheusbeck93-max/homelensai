/**
 * Shared property-URL scraper.
 *
 * Wraps the Firecrawl markdown scrape used by both `perplexity-chat` and
 * `ai-chat` so they share the same timeout, retry, and degradation policy.
 *
 * Note: `fetch-property` is the other Firecrawl-backed scraper in the repo;
 * because both ultimately call the same Firecrawl API, this module focuses on
 * a single bounded retry + graceful degradation instead of a true secondary
 * provider. When Firecrawl is unavailable, callers receive
 * `{ markdown: null, source: 'none', reason }` and should surface a clear
 * "couldn't fetch the page directly" note to the user.
 */

const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';
const MAX_MARKDOWN_CHARS = 8000;
const TIMEOUT_MS = 25_000;

export interface ScrapeResult {
  markdown: string | null;
  source: 'firecrawl' | 'none';
  reason?: string;
}

async function firecrawlOnce(url: string, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(FIRECRAWL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 5000,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[scrapeProperty] Firecrawl HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const md: string = data?.data?.markdown || data?.markdown || '';
    return md ? md.substring(0, MAX_MARKDOWN_CHARS) : null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Scrape a property URL. Returns `{ markdown: null, source: 'none' }` with a
 * `reason` when scraping fails — never throws.
 */
export async function scrapeProperty(url: string): Promise<ScrapeResult> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    return { markdown: null, source: 'none', reason: 'FIRECRAWL_API_KEY not configured' };
  }

  try {
    const md = await firecrawlOnce(url, apiKey);
    if (md) return { markdown: md, source: 'firecrawl' };
  } catch (e) {
    console.error('[scrapeProperty] First attempt failed:', e);
  }

  // One retry — Firecrawl can transient-fail on JS-heavy listing pages.
  try {
    const md = await firecrawlOnce(url, apiKey);
    if (md) return { markdown: md, source: 'firecrawl' };
  } catch (e) {
    console.error('[scrapeProperty] Retry failed:', e);
    return { markdown: null, source: 'none', reason: 'Firecrawl error after retry' };
  }

  return { markdown: null, source: 'none', reason: 'No content from Firecrawl' };
}

/** Stable user-facing degradation note appended to prompts when scraping fails. */
export const SCRAPE_FAILED_NOTE =
  "(Note: I couldn't fetch the property page directly — answering from the URL and your message alone. Some details below are inferred.)";
