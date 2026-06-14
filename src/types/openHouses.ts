// Mirrors supabase/functions/_shared/openHouses/types.ts for the frontend.

export type OpenHouseCountry = 'US' | 'CA';

export interface OpenHouseFilters {
  country: OpenHouseCountry;
  state?: string | null;
  city?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

export interface OpenHouseEvent {
  start: string;
  end: string;
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

export interface OpenHouseAlert {
  id: string;
  user_id: string;
  country: OpenHouseCountry;
  state: string | null;
  city: string | null;
  filters: Record<string, unknown>;
  frequency: 'daily' | 'weekly';
  enabled: boolean;
  last_sent_at: string | null;
  created_at: string;
}
