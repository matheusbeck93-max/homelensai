import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HomeLensListing } from "@/types/ui-blocks";

interface SearchParams {
  location: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  propertyType?: string;
}

interface SearchResult {
  listings: HomeLensListing[];
}

/**
 * Custom hook for property search with React Query caching
 * Implements 5-minute stale time as per P1 requirements
 */
export function usePropertySearch(params: SearchParams | null) {
  return useQuery({
    queryKey: ['property-search', params],
    queryFn: async () => {
      if (!params) {
        throw new Error('Search parameters are required');
      }

      const { data, error } = await supabase.functions.invoke<SearchResult>('search-listings', {
        body: params,
      });

      if (error) {
        throw error;
      }

      return data?.listings || [];
    },
    enabled: !!params,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
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
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
  });
}
