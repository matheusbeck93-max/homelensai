/**
 * Universal Property Listing Detector
 * Analyzes DOM content and URL patterns to determine if the current page
 * is an American real estate listing.
 */

interface DetectionResult {
  isListing: boolean;
  confidence: number;
  signals: string[];
}

export interface ExtractedPropertyData {
  externalUrl: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSize?: number;
  yearBuilt?: number;
  propertyType?: string;
  imageUrl?: string;
  description?: string;
  sourceSignals: string[];
  confidence: number;
}

type PropertyShape = Omit<ExtractedPropertyData, 'externalUrl' | 'sourceSignals' | 'confidence'>;

function parseCurrency(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^\d.]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round(parsed);
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (!cleaned) return undefined;
    const parsed = Number(cleaned[0]);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
  }
  return undefined;
}

function parseAreaToSqft(value: unknown, unitText?: string): number | undefined {
  const amount = parseNumber(value);
  if (!amount) return undefined;

  const unit = (unitText || '').toLowerCase();
  if (unit.includes('m2') || unit.includes('sqm') || unit.includes('squaremeter')) {
    return Math.round(amount * 10.7639);
  }

  // If no unit is provided, assume sqft
  return Math.round(amount);
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function flattenJsonLd(input: any): any[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap(flattenJsonLd);
  if (typeof input !== 'object') return [];

  const graph = Array.isArray(input['@graph']) ? input['@graph'] : [];
  return [input, ...graph.flatMap(flattenJsonLd)];
}

function extractFromJsonLd(): { data: PropertyShape; signals: string[] } {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  const nodes: any[] = [];

  scripts.forEach((script) => {
    const parsed = safeJsonParse(script.textContent || '');
    if (parsed) {
      nodes.push(...flattenJsonLd(parsed));
    }
  });

  const listingNode = nodes.find((node) => {
    const type = String(node?.['@type'] || '').toLowerCase();
    return (
      type.includes('realestatelisting') ||
      type.includes('singlefamilyresidence') ||
      type.includes('house') ||
      type.includes('residence') ||
      type.includes('apartment') ||
      type.includes('place')
    );
  });

  if (!listingNode) return { data: {}, signals: [] };

  const signals: string[] = ['jsonld'];
  const offers = listingNode.offers || listingNode.makesOffer || {};
  const addressObj = listingNode.address || {};
  const floorSize = listingNode.floorSize || {};
  const lotSize = listingNode.lotSize || listingNode.landSize || {};

  const data: PropertyShape = {
    price: parseCurrency(offers.price) || parseCurrency(listingNode.price),
    beds: parseNumber(listingNode.numberOfBedrooms ?? listingNode.bedrooms),
    baths: parseNumber(
      listingNode.numberOfBathroomsTotal ??
      listingNode.numberOfBathrooms ??
      listingNode.bathrooms,
    ),
    sqft:
      parseAreaToSqft(floorSize.value, floorSize.unitCode || floorSize.unitText) ||
      parseAreaToSqft(listingNode.floorSize),
    lotSize:
      parseAreaToSqft(lotSize.value, lotSize.unitCode || lotSize.unitText) ||
      parseAreaToSqft(listingNode.lotSize),
    yearBuilt: parseNumber(listingNode.yearBuilt),
    propertyType: normalizeString(listingNode.additionalType || listingNode.homeType || listingNode['@type']),
    description: normalizeString(listingNode.description),
    imageUrl: normalizeString(
      Array.isArray(listingNode.image) ? listingNode.image[0] : listingNode.image,
    ),
    address: normalizeString(addressObj.streetAddress),
    city: normalizeString(addressObj.addressLocality),
    state: normalizeString(addressObj.addressRegion),
    zip: normalizeString(addressObj.postalCode),
  };

  return { data, signals };
}

function extractAddressFromHeading(): PropertyShape {
  const h1 = document.querySelector('h1')?.textContent?.trim();
  if (!h1) return {};

  const locationMatch = h1.match(/,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/);
  return {
    address: h1,
    city: locationMatch?.[1]?.trim(),
    state: locationMatch?.[2],
    zip: locationMatch?.[3],
  };
}

function extractFromMeta(): { data: PropertyShape; signals: string[] } {
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const metaDescription =
    document.querySelector('meta[name="description"]')?.getAttribute('content') ||
    document.querySelector('meta[property="og:description"]')?.getAttribute('content');

  const signals: string[] = [];
  const data: PropertyShape = {};

  if (ogImage) {
    data.imageUrl = ogImage;
    signals.push('meta_image');
  }
  if (metaDescription) {
    data.description = metaDescription;
    signals.push('meta_description');
  }
  if (ogTitle && !data.address) {
    data.address = ogTitle.replace(/\s*[|·-]\s*(zillow|redfin|realtor|trulia|homes\.com).*$/i, '').trim();
    signals.push('meta_title');
  }

  return { data, signals };
}

function readNumericByLabel(text: string, regex: RegExp): number | undefined {
  const match = text.match(regex);
  if (!match?.[1]) return undefined;
  return parseNumber(match[1]);
}

function extractFromDom(): { data: PropertyShape; signals: string[] } {
  const selectors = [
    '[data-testid*="price"]',
    '[class*="price"]',
    '[aria-label*="price"]',
    '[class*="bed"]',
    '[class*="bath"]',
    '[class*="sqft"]',
    '[class*="detail"]',
    'h1',
    'h2',
  ];

  const text = Array.from(document.querySelectorAll(selectors.join(',')))
    .map((el) => el.textContent || '')
    .join(' ')
    .slice(0, 120000);

  const bodyText = (document.body.textContent || '').slice(0, 150000);

  const priceCandidates = Array.from(text.matchAll(/\$\s*([\d,]{4,})/g))
    .map((m) => parseCurrency(m[0]))
    .filter((n): n is number => typeof n === 'number' && n >= 10000 && n <= 100000000);

  const data: PropertyShape = {
    price: priceCandidates.length ? Math.min(...priceCandidates) : undefined,
    beds: readNumericByLabel(text, /(\d+(?:\.\d+)?)\s*(?:bed|beds|bd|bedroom)s?\b/i),
    baths: readNumericByLabel(text, /(\d+(?:\.\d+)?)\s*(?:bath|baths|ba|bathroom)s?\b/i),
    sqft: readNumericByLabel(
      text,
      /([\d,]+)\s*(?:sq\.?\s*ft|sqft|square\s*feet)\b(?!\s*(?:lot|lot\s*size))/i,
    ),
    lotSize: readNumericByLabel(
      text,
      /(?:lot\s*size[^\d]{0,15}|\blot\b[^\d]{0,15})([\d,]+)\s*(?:sq\.?\s*ft|sqft)/i,
    ),
    yearBuilt: readNumericByLabel(bodyText, /(?:year\s*built|built\s*in|built)\D{0,12}(19\d{2}|20\d{2})/i),
  };

  const headingAddress = extractAddressFromHeading();
  Object.assign(data, headingAddress);

  const signals: string[] = [];
  if (data.price) signals.push('dom_price');
  if (data.beds) signals.push('dom_beds');
  if (data.baths) signals.push('dom_baths');
  if (data.sqft) signals.push('dom_sqft');
  if (data.address) signals.push('dom_address');

  return { data, signals };
}

function mergePropertyData(
  jsonLdData: PropertyShape,
  metaData: PropertyShape,
  domData: PropertyShape,
): PropertyShape {
  // Priority: JSON-LD > DOM > Meta
  return {
    address: jsonLdData.address || domData.address || metaData.address,
    city: jsonLdData.city || domData.city,
    state: jsonLdData.state || domData.state,
    zip: jsonLdData.zip || domData.zip,
    price: jsonLdData.price || domData.price,
    beds: jsonLdData.beds || domData.beds,
    baths: jsonLdData.baths || domData.baths,
    sqft: jsonLdData.sqft || domData.sqft,
    lotSize: jsonLdData.lotSize || domData.lotSize,
    yearBuilt: jsonLdData.yearBuilt || domData.yearBuilt,
    propertyType: jsonLdData.propertyType || domData.propertyType,
    imageUrl: jsonLdData.imageUrl || metaData.imageUrl,
    description: jsonLdData.description || metaData.description,
  };
}

export function detectPropertyListing(): DetectionResult {
  const signals: string[] = [];
  let confidence = 0;

  // Gather visible text from relevant elements only (performance optimization)
  const selectors = 'h1, h2, h3, p, span, [class*="price"], [class*="bed"], [class*="bath"], [class*="detail"], [class*="listing"], [class*="property"], [class*="address"], [data-testid], [class*="home"], [class*="sqft"], [class*="mls"]';
  const elements = document.querySelectorAll(selectors);
  let visibleText = '';
  elements.forEach((el) => {
    visibleText += ' ' + (el.textContent || '');
  });
  // Limit text size for performance
  visibleText = visibleText.slice(0, 50000).toLowerCase();

  const url = window.location.href.toLowerCase();
  const hostname = window.location.hostname.toLowerCase();

  // ── HIGH CONFIDENCE SIGNALS (15 points each) ──

  // 1. Real estate price pattern: $XXX,XXX or $X,XXX,XXX
  if (/\$[\d,]{6,}/.test(visibleText)) {
    confidence += 15;
    signals.push('price_pattern');
  }

  // 2. Beds AND baths present together
  const hasBeds = /\b(bed|beds|br|bedroom|bedrooms)\b/.test(visibleText);
  const hasBaths = /\b(bath|baths|ba|bathroom|bathrooms)\b/.test(visibleText);
  if (hasBeds && hasBaths) {
    confidence += 15;
    signals.push('beds_and_baths');
  }

  // 3. Square footage
  if (/\b(sqft|sq\s*ft|square\s*feet|sq\.\s*ft)\b/.test(visibleText)) {
    confidence += 15;
    signals.push('sqft');
  }

  // 4. og:type meta tag
  const ogType = document.querySelector('meta[property="og:type"]')?.getAttribute('content')?.toLowerCase() || '';
  if (ogType.includes('realestate') || ogType.includes('home_listing')) {
    confidence += 15;
    signals.push('og_type_realestate');
  }

  // 5. URL contains known listing patterns
  const urlListingPatterns = [
    '/homedetails/', '/homes-detail/', '/home-details/', '/listing/',
    '/property/', '/for-sale/', '/mls/', '/realestateandhomes-detail/',
    '/homes/', '/p/', '/real-estate/',
  ];
  if (urlListingPatterns.some((p) => url.includes(p))) {
    confidence += 15;
    signals.push('url_listing_pattern');
  }

  // ── MEDIUM CONFIDENCE SIGNALS (8 points each) ──

  // MLS reference
  if (/\b(mls\s*#|mls\s*id|mls\s*number|mls:)\b/.test(visibleText) || /\bmls\b/.test(visibleText)) {
    confidence += 8;
    signals.push('mls_reference');
  }

  // Year built
  if (/\b(year\s*built|built\s*in)\s*(19|20)\d{2}\b/.test(visibleText)) {
    confidence += 8;
    signals.push('year_built');
  }

  // Lot size
  if (/\b(lot\s*size|lot:)\b/.test(visibleText)) {
    confidence += 8;
    signals.push('lot_size');
  }

  // Garage/parking with number
  if (/\b(garage|parking)\b/.test(visibleText) && /\d+\s*(car|space|spot)/i.test(visibleText)) {
    confidence += 8;
    signals.push('garage_parking');
  }

  // American address format: number + street + city + 2-letter state + ZIP
  if (/\d+\s+[\w\s]+,\s*[\w\s]+,\s*[A-Z]{2}\s+\d{5}/.test(document.body.textContent?.slice(0, 30000) || '')) {
    confidence += 8;
    signals.push('us_address_format');
  }

  // HOA
  if (/\b(hoa|hoa\s*fee|homeowners?\s*association)\b/.test(visibleText)) {
    confidence += 8;
    signals.push('hoa');
  }

  // Schema.org markup
  const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
  schemaScripts.forEach((script) => {
    const text = (script.textContent || '').toLowerCase();
    if (text.includes('realestatelisting') || text.includes('residence') || text.includes('singlefamilyresidence')) {
      confidence += 8;
      signals.push('schema_org');
    }
  });

  // ── LOW CONFIDENCE SIGNALS (4 points each) ──

  if (/\bproperty\s*type\b/.test(visibleText)) {
    confidence += 4;
    signals.push('property_type');
  }

  if (/\b(listing\s*agent|listing\s*by|listed\s*by)\b/.test(visibleText)) {
    confidence += 4;
    signals.push('listing_agent');
  }

  if (/\b(days?\s*on\s*market|listed\s+\w+\s+\d{1,2})\b/.test(visibleText)) {
    confidence += 4;
    signals.push('days_on_market');
  }

  // Domain-based signal
  const realtorDomains = [
    'zillow', 'redfin', 'realtor', 'trulia', 'homes.com', 'remax', 'coldwell',
    'compass', 'century21', 'keller', 'berkshire', 'sotheby', 'opendoor',
    'offerpad', 'homie', 'homesnap', 'movoto', 'estately', 'houzeo',
    'landwatch', 'loopnet', 'crexi',
  ];
  const isDomainMatch = realtorDomains.some((d) => hostname.includes(d));
  if (isDomainMatch) {
    confidence += 4;
    signals.push('realtor_domain');
  }

  // ── THRESHOLD ──
  let isListing = false;
  if (confidence >= 30) {
    isListing = true;
  } else if (confidence >= 15 && isDomainMatch) {
    isListing = true;
  }

  return { isListing, confidence, signals };
}

export function extractPropertyDataFromPage(): ExtractedPropertyData | null {
  const pageUrl = getPageUrl();

  const { data: jsonLdData, signals: jsonLdSignals } = extractFromJsonLd();
  const { data: metaData, signals: metaSignals } = extractFromMeta();
  const { data: domData, signals: domSignals } = extractFromDom();

  const merged = mergePropertyData(jsonLdData, metaData, domData);

  const signals = [...jsonLdSignals, ...metaSignals, ...domSignals];
  const availableFields = [
    merged.address,
    merged.price,
    merged.beds,
    merged.baths,
    merged.sqft,
    merged.city,
    merged.state,
    merged.yearBuilt,
  ].filter((v) => v !== undefined && v !== null).length;

  if (availableFields < 3) {
    return null;
  }

  const confidence = Math.min(100, 35 + availableFields * 8 + (jsonLdSignals.length ? 20 : 0));

  return {
    externalUrl: pageUrl,
    ...merged,
    sourceSignals: Array.from(new Set(signals)),
    confidence,
  };
}

/**
 * Get the canonical page URL
 */
export function getPageUrl(): string {
  const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content');
  if (ogUrl && ogUrl.startsWith('http')) return ogUrl;

  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (canonical && canonical.startsWith('http')) return canonical;

  return window.location.href;
}
