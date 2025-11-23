/**
 * Determines if a user input looks like a property search query
 * @param input - The user's text input
 * @returns true if it appears to be a property search
 */
export const isPropertySearchQuery = (input: string): boolean => {
  const hasHomeKeywords = /(home|house|condo|property|apartment|townhome|listing)s?/i.test(input);
  const hasLocation = /(in|near)\s+[a-zA-Z]+/i.test(input) || /[A-Za-z]+,\s*[A-Za-z]{2}/.test(input);
  return hasHomeKeywords && hasLocation;
};

/**
 * Parses natural language property search query into structured parameters
 * @param query - The user's search query
 * @returns Parsed search parameters
 */
export const parsePropertySearchQuery = (query: string) => {
  // Extract price
  const priceMatch = query.match(/under (\$?[\d,]+k?)/i);
  let maxPrice: number | undefined;
  if (priceMatch) {
    const priceStr = priceMatch[1].replace(/[$,]/g, '');
    maxPrice = priceStr.includes('k') 
      ? parseInt(priceStr) * 1000 
      : parseInt(priceStr);
  }
  
  // Extract bedrooms
  const bedsMatch = query.match(/(\d+)\s*(bed|bedroom)/i);
  const minBeds = bedsMatch ? parseInt(bedsMatch[1]) : undefined;
  
  // Extract location
  const cityStateMatch = query.match(/in\s+([a-z\s,]+)/i);
  const location = cityStateMatch ? cityStateMatch[1].trim() : '';
  
  // Extract property type - only set specific type if explicitly mentioned
  // Generic terms like "home", "homes", "property", "properties" return all types
  let propertyType: 'house' | 'condo' | 'townhome' | 'multi' | 'any' = 'any';
  if (/\bcondo/i.test(query)) propertyType = 'condo';
  else if (/townhome/i.test(query)) propertyType = 'townhome';
  else if (/multi[-\s]?family/i.test(query)) propertyType = 'multi';
  else if (/single[-\s]?family\s+house/i.test(query)) propertyType = 'house';
  // Note: "home", "homes", "property", "properties" default to 'any' for broader results
  
  return {
    location,
    maxPrice,
    minBeds,
    propertyType
  };
};
