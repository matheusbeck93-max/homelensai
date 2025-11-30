/**
 * Normalized Property interface for HomeLens
 * Used across all property search and display features
 */
export interface Property {
  id: string;
  source: "zillow";
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;

  price: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  status?: string;
  imageUrl?: string;

  zestimate?: number;
  rentZestimate?: number;

  raw?: any;  // Keep original object for deep dives
}

/**
 * Response format from search-listings edge function
 */
export interface PropertySearchResponse {
  source: "zillow" | "cache" | "stale cache" | "none";
  status: "ok" | "unavailable";
  reason?: "auth_or_subscription" | "temporary_error";
  listings: Property[];
  pagination?: {
    totalResults: number;
    resultsPerPage: number;
    totalPages: number;
  };
  message?: string;
}
