/**
 * Determines if a user input looks like a property search query
 * @param input - The user's text input
 * @returns true if it appears to be a property search
 */
export const isPropertySearchQuery = (input: string): boolean => {
  const lowerInput = input.toLowerCase();
  
  // Check for search intent keywords
  const hasSearchIntent = /find|search|show|looking for|need|want/i.test(input);
  
  // Check for property keywords
  const hasPropertyKeywords = /home|house|property|condo|apartment|townhome|real estate/i.test(input);
  
  // Check for location indicator
  const hasLocation = /in\s+[a-z]/i.test(input);
  
  // Must have search intent AND (property keywords OR location)
  return hasSearchIntent && (hasPropertyKeywords || hasLocation);
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
  
  // Extract property type
  let propertyType: 'house' | 'condo' | 'townhome' | 'multi' | 'any' = 'any';
  if (/\bcondo/i.test(query)) propertyType = 'condo';
  else if (/townhome/i.test(query)) propertyType = 'townhome';
  else if (/multi[-\s]?family/i.test(query)) propertyType = 'multi';
  else if (/house|home/i.test(query)) propertyType = 'house';
  
  return {
    location,
    maxPrice,
    minBeds,
    propertyType
  };
};
