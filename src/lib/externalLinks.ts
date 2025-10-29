// Helper functions to generate external real estate site links

interface PropertyInfo {
  address: string;
  city: string;
  state: string;
  zip?: string;
}

// Zillow link generation removed - no external API integration

export function generateRealtorLink(property: PropertyInfo): string {
  const query = encodeURIComponent(`${property.address}, ${property.city}, ${property.state} ${property.zip || ''}`);
  return `https://www.realtor.com/realestateandhomes-search/${query}`;
}

// Redfin link generation removed - no external API integration

export function generateTruliaLink(property: PropertyInfo): string {
  const query = encodeURIComponent(`${property.address}, ${property.city}, ${property.state}`);
  return `https://www.trulia.com/search/${query}`;
}

export function generateHomesLink(property: PropertyInfo): string {
  const query = encodeURIComponent(`${property.address} ${property.city} ${property.state}`);
  return `https://www.homes.com/search/${query}/`;
}

export function generateApartmentsLink(property: PropertyInfo): string {
  const city = property.city.toLowerCase().replace(/\s+/g, '-');
  const state = property.state.toLowerCase();
  return `https://www.apartments.com/${city}-${state}/`;
}

export const externalSites = [
  { name: 'Realtor.com', generator: generateRealtorLink },
  { name: 'Trulia', generator: generateTruliaLink },
  { name: 'Homes.com', generator: generateHomesLink },
  { name: 'Apartments.com', generator: generateApartmentsLink },
];
