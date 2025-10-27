// Helper functions to generate external real estate site links

interface PropertyInfo {
  address: string;
  city: string;
  state: string;
  zip?: string;
}

export function generateZillowLink(property: PropertyInfo): string {
  const query = encodeURIComponent(`${property.address}, ${property.city}, ${property.state} ${property.zip || ''}`);
  return `https://www.zillow.com/homes/${query}_rb/`;
}

export function generateRealtorLink(property: PropertyInfo): string {
  const query = encodeURIComponent(`${property.address}, ${property.city}, ${property.state} ${property.zip || ''}`);
  return `https://www.realtor.com/realestateandhomes-search/${query}`;
}

export function generateRedfinLink(property: PropertyInfo): string {
  const stateCode = property.state.toLowerCase();
  const city = property.city.toLowerCase().replace(/\s+/g, '-');
  return `https://www.redfin.com/city/${city}/${stateCode}`;
}

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
  { name: 'Zillow', generator: generateZillowLink },
  { name: 'Realtor.com', generator: generateRealtorLink },
  { name: 'Redfin', generator: generateRedfinLink },
  { name: 'Trulia', generator: generateTruliaLink },
  { name: 'Homes.com', generator: generateHomesLink },
  { name: 'Apartments.com', generator: generateApartmentsLink },
];
