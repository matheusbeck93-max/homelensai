/**
 * Shared types for the Open House Finder feature.
 * Used by edge functions, chat tools, and frontend (via re-export).
 */

export type OpenHouseCountry = 'US' | 'CA';

export interface OpenHouseFilters {
  country: OpenHouseCountry;
  state?: string | null;
  city?: string | null;
  dateFrom?: string | null; // ISO date YYYY-MM-DD
  dateTo?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

export interface OpenHouseEvent {
  start: string; // ISO datetime
  end: string;   // ISO datetime
  type: 'in-person' | 'virtual';
}

export interface OpenHouseListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip?: string | null;
  country: OpenHouseCountry;
  price: number;
  beds: number;
  baths: number;
  sqft?: number | null;
  lat?: number | null;
  lng?: number | null;
  photo?: string | null;
  listingUrl: string;
  source: 'redfin' | 'realtor' | 'cache';
  openHouses: OpenHouseEvent[];
}

export interface OpenHouseSearchResult {
  listings: OpenHouseListing[];
  fetchedAt: string;
  fromCache: boolean;
  remainingQuota?: number | null;
}
