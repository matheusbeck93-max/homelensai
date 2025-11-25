/**
 * Parses a location string into zip, city, and state components
 * @param location - Location string like "Miami, FL" or "33183" or "Arlington, Virginia"
 * @returns Object with zip, city, and state fields
 */
export const parseLocationComponents = (location: string): {
  zip?: string;
  city?: string;
  state?: string;
} => {
  if (!location) return {};
  
  const trimmed = location.trim();
  
  // Check if it's a ZIP code (5 digits)
  if (/^\d{5}$/.test(trimmed)) {
    return { zip: trimmed };
  }
  
  // Check for "City, State" or "City, ST" pattern
  const cityStateMatch = trimmed.match(/^([^,]+),\s*([A-Za-z]{2,})$/);
  if (cityStateMatch) {
    const city = cityStateMatch[1].trim();
    const state = cityStateMatch[2].trim();
    return { city, state };
  }
  
  // If no clear pattern, try to extract city (everything before comma) and state (after comma)
  const parts = trimmed.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return {
      city: parts[0],
      state: parts[1]
    };
  }
  
  // Single word - likely just a city name without state
  return { city: trimmed };
};

/**
 * Determines if a user input looks like a property search query
 * @param input - The user's text input
 * @returns true if it appears to be a property search
 */
export const isPropertySearchQuery = (input: string): boolean => {
  // Match property-related keywords including plural forms and common phrases
  const hasHomeKeywords = /(homes?|houses?|condos?|condominium|propert(?:y|ies)|apartments?|townhomes?|listings?|single[- ]family|multi[- ]family|duplex|triplex)/i.test(input);
  
  // Match various location patterns:
  // - "in City, State" or "in City, ST" (with full state name or abbreviation)
  // - "in City"
  // - "near ZIP" or "in ZIP"
  // - Just "City, State" or "ZIP"
  const hasLocation = 
    /(in|near|at|around)\s+[a-zA-Z\s,]+/i.test(input) || // "in Arlington, Virginia"
    /\b\d{5}\b/.test(input) || // ZIP code
    /[A-Za-z]+,\s*[A-Za-z]{2,}/i.test(input); // "City, State" with 2+ letter state
  
  return hasHomeKeywords && hasLocation;
};

/**
 * Parses natural language property search query into structured parameters
 * @param query - The user's search query
 * @returns Parsed search parameters with validation
 */
export const parsePropertySearchQuery = (query: string) => {
  const lowerQuery = query.toLowerCase();
  
  // Extract location - multiple patterns
  let location = '';
  
  // Pattern 1: "in City, State" or "near City, State"
  const inNearMatch = query.match(/(?:in|near|at|around)\s+([a-zA-Z\s,]+?)(?:\s+(?:with|under|over|between|for|\d|$))/i);
  if (inNearMatch) {
    location = inNearMatch[1].trim();
  }
  
  // Pattern 2: ZIP code
  const zipMatch = query.match(/\b(\d{5})\b/);
  if (zipMatch && !location) {
    location = zipMatch[1];
  }
  
  // Pattern 3: "City, State" standalone
  const cityStateMatch = query.match(/\b([A-Za-z\s]+,\s*[A-Za-z]{2,})\b/);
  if (cityStateMatch && !location) {
    location = cityStateMatch[1].trim();
  }
  
  // Clean up location (remove trailing words that aren't part of location)
  location = location.replace(/\s+(with|under|over|between|for).*$/i, '').trim();
  
  // Extract price ranges
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  
  // "under X", "below X"
  const underMatch = query.match(/(?:under|below)\s+\$?([\d,]+)k?/i);
  if (underMatch) {
    const priceStr = underMatch[1].replace(/,/g, '');
    maxPrice = priceStr.includes('k') || parseInt(priceStr) < 10000
      ? parseInt(priceStr) * 1000 
      : parseInt(priceStr);
  }
  
  // "over X", "above X", "at least X"
  const overMatch = query.match(/(?:over|above|at\s+least)\s+\$?([\d,]+)k?/i);
  if (overMatch) {
    const priceStr = overMatch[1].replace(/,/g, '');
    minPrice = priceStr.includes('k') || parseInt(priceStr) < 10000
      ? parseInt(priceStr) * 1000 
      : parseInt(priceStr);
  }
  
  // "between X and Y"
  const betweenMatch = query.match(/between\s+\$?([\d,]+)k?\s+(?:and|to)\s+\$?([\d,]+)k?/i);
  if (betweenMatch) {
    const price1Str = betweenMatch[1].replace(/,/g, '');
    const price2Str = betweenMatch[2].replace(/,/g, '');
    const price1 = parseInt(price1Str) * (price1Str.length <= 3 ? 1000 : 1);
    const price2 = parseInt(price2Str) * (price2Str.length <= 3 ? 1000 : 1);
    minPrice = Math.min(price1, price2);
    maxPrice = Math.max(price1, price2);
  }
  
  // Extract bedrooms
  let minBeds: number | undefined;
  let maxBeds: number | undefined;
  
  // "min X bed", "at least X bed", "X+ bed"
  const minBedsMatch = query.match(/(?:min(?:imum)?|at\s+least)\s+(\d+)\s*(?:bed|br)/i) || 
                       query.match(/(\d+)\+\s*(?:bed|br)/i);
  if (minBedsMatch) {
    minBeds = parseInt(minBedsMatch[1]);
  }
  
  // "X bed" or "X bedroom" (without min/max qualifiers)
  const bedsMatch = query.match(/\b(\d+)\s*(?:bed|bedroom)/i);
  if (bedsMatch && !minBeds) {
    minBeds = parseInt(bedsMatch[1]);
  }
  
  // Extract bathrooms
  let minBaths: number | undefined;
  const bathsMatch = query.match(/(?:min(?:imum)?|at\s+least)?\s*(\d+(?:\.\d+)?)\s*(?:bath|ba\b)/i);
  if (bathsMatch) {
    minBaths = parseFloat(bathsMatch[1]);
  }
  
  // Extract property type with synonym mapping
  let propertyType: 'house' | 'condo' | 'townhome' | 'multi' | 'any' = 'any';
  
  if (/\b(?:single[- ]?family|single[- ]?family\s+home|sfh)\b/i.test(query)) {
    propertyType = 'house';
  } else if (/\b(?:condo(?:minium)?s?)\b/i.test(query)) {
    propertyType = 'condo';
  } else if (/\b(?:townhome|townhouse|town[- ]?home)s?\b/i.test(query)) {
    propertyType = 'townhome';
  } else if (/\b(?:multi[- ]?family|duplex|triplex|fourplex)s?\b/i.test(query)) {
    propertyType = 'multi';
  }
  // Generic terms like "home", "house", "property" without modifiers stay as 'any'
  
  return {
    location,
    minPrice,
    maxPrice,
    minBeds,
    maxBeds,
    minBaths,
    propertyType,
    // Add validation flag
    isValid: !!location // Must have at least a location
  };
};
