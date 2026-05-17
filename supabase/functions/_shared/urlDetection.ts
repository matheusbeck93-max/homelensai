/**
 * Shared URL detection for the HomeLens AI Agent.
 *
 * Single source of truth for "is this a real estate property URL?" used by
 * `perplexity-chat` and `ai-chat` (replacing two divergent regexes that
 * routed the same listing through different branches).
 *
 * The whitelist is the UNION of every domain previously recognized by
 * either backend, plus a few obvious portals that were missing from one
 * side or the other.
 */

const PROPERTY_PORTAL_DOMAINS = [
  'zillow.com',
  'redfin.com',
  'realtor.com',
  'realtor.ca',
  'trulia.com',
  'homes.com',
  'movoto.com',
  'compass.com',
  'century21.com',
  'coldwellbanker.com',
  'sothebysrealty.com',
  'berkshirehathawayhs.com',
  'berkshirehathaway.com',
  'redfin.ca',
] as const;

const PROPERTY_URL_LOOSE_PATTERN = /\/(property|listing|home|house|homedetails|for-sale)[\/?#]/i;

/** Try to parse and normalize a URL string; return null if invalid. */
function tryUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** True if `url` points to a known real estate portal or matches a generic property path. */
export function isPropertyUrl(url: string): boolean {
  const u = tryUrl(url);
  if (!u) return false;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (PROPERTY_PORTAL_DOMAINS.some((d) => host === d || host.endsWith('.' + d))) {
    return true;
  }
  return PROPERTY_URL_LOOSE_PATTERN.test(u.pathname + u.search);
}

/** True if `text` contains at least one property URL. */
export function containsPropertyUrl(text: string): boolean {
  const matches = text.match(/https?:\/\/[^\s)]+/gi) || [];
  return matches.some((m) => isPropertyUrl(m.replace(/[.,;:!?]+$/, '')));
}

/** Extract every URL in text (any domain). Trailing punctuation trimmed. */
export function extractAllUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)]+/gi) || [];
  return matches.map((m) => m.replace(/[.,;:!?]+$/, ''));
}

/** Extract every property URL in text, in document order. */
export function extractAllPropertyUrls(text: string): string[] {
  return extractAllUrls(text).filter(isPropertyUrl);
}

/** First property URL in text (if any). */
export function extractFirstPropertyUrl(text: string): string | null {
  return extractAllPropertyUrls(text)[0] ?? null;
}

/**
 * Cheap shape-validator for SEARCH-mode portal links produced by the LLM.
 * Returns true if the URL parses AND (for known portals) has a path shape
 * consistent with a search/filter page. Unknown portals pass through.
 */
export function isValidPortalSearchUrl(url: string): boolean {
  const u = tryUrl(url);
  if (!u) return false;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const path = u.pathname;
  if (host.endsWith('zillow.com')) return /^\/[a-z0-9-]+(_rb)?\/?$|^\/homes\//.test(path);
  if (host.endsWith('redfin.com')) return /^\/(city|zipcode|state)\//.test(path);
  if (host.endsWith('realtor.com')) return /^\/realestateandhomes-search\//.test(path);
  return true;
}
