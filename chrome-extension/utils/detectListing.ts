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
    '/homes/', '/p/', '/real-estate/'
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
    'landwatch', 'loopnet', 'crexi'
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
