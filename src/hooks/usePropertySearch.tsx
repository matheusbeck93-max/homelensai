import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Property, PropertySearchResponse } from "@/types/property";
import { HomeLensListing } from "@/types/ui-blocks";

interface SearchParams {
  query?: string;
  location?: string;
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  baths_min?: number;
  prop_type?: string;
  page?: number;
}

/**
 * Custom hook for property search with React Query caching
 * Calls search-listings edge function and normalizes response
 */
export function usePropertySearch(params: SearchParams | null) {
  return useQuery({
    queryKey: ['property-search', params],
    queryFn: async () => {
      if (!params) {
        throw new Error('Search parameters are required');
      }

      const { data, error } = await supabase.functions.invoke<PropertySearchResponse>('search-listings', {
        body: params,
      });

      if (error) {
        console.warn('Property search error:', error);
        return { listings: [], source: 'none', status: 'unavailable' };
      }

      // Map Property[] to HomeLensListing[] for backward compatibility
      const listings: HomeLensListing[] = (data?.listings || []).map((prop: Property) => ({
        id: prop.id,
        address: `${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}`,
        price: prop.price,
        beds: prop.bedrooms ?? null,
        baths: prop.bathrooms ?? null,
        sqft: prop.sqft ?? null,
        photoUrl: prop.imageUrl ?? null,
        listingUrl: null,
        status: prop.status ?? null,
        source: prop.source,
        city: prop.city,
        state: prop.state,
        zip: prop.zip,
        lat: prop.latitude ?? null,
        lng: prop.longitude ?? null,
        zestimate: prop.zestimate ?? null,
        rentZestimate: prop.rentZestimate ?? null,
        pricePerSqft: prop.pricePerSqft ?? null,
        fairPriceScore: prop.fairPriceScore ?? null,
        fairPriceLevel: prop.fairPriceLevel ?? null,
      }));

      return listings;
    },
    enabled: !!params,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 1,
    retryDelay: 2000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Custom hook for property enrichment with caching
 */
export function usePropertyEnrichment(
  address: string | null,
  city: string | null,
  state: string | null,
  zip: string | null
) {
  return useQuery({
    queryKey: ['property-enrichment', address, city, state, zip],
    queryFn: async () => {
      if (!address || !zip) {
        throw new Error('Address and zip are required');
      }

      const { data, error } = await supabase.functions.invoke('enrich-property', {
        body: { address, city, state, zip },
      });

      if (error) {
        throw error;
      }

      return data?.insights || null;
    },
    enabled: !!(address && zip),
    staleTime: 10 * 60 * 1000, // 10 minutes - increased to reduce API calls
    gcTime: 20 * 60 * 1000, // 20 minutes
    retry: 1, // Only retry once to avoid compounding rate limit issues
    retryDelay: 2000, // Fixed 2 second delay
  });
}
