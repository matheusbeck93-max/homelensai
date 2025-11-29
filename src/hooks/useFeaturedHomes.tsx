import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HomeLensListing } from '@/types/ui-blocks';
import { useToast } from '@/hooks/use-toast';
import { getCachedData, setCachedData, isCacheValid } from '@/lib/useApiCache';
import { checkRateLimit } from '@/lib/useRateLimit';

type FeaturedHomesState = {
  locationLabel: string;
  listings: HomeLensListing[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
};

const DEFAULT_LOCATIONS = ['Miami, FL', 'Austin, TX', 'Phoenix, AZ'];

// Cache and rate limiting configuration
const CACHE_KEY_PREFIX = 'homelens_featured_homes_';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_KEY = 'homelens_featured_homes_rate_limit';
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 2;

export function useFeaturedHomes(userPreferredArea?: string | null): FeaturedHomesState {
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [listings, setListings] = useState<HomeLensListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const { toast } = useToast();

  const fetchListings = async (location: string, pageNum: number = 1, append: boolean = false) => {
    // Prevent duplicate concurrent calls
    if (isFetching && !append) {
      console.log('[useFeaturedHomes] Search already in progress, skipping duplicate call');
      return;
    }
    
    setIsFetching(true);

    const cacheKey = `${CACHE_KEY_PREFIX}${location}`;

    // Check cache first (only for initial load)
    if (!append && pageNum === 1) {
      const cached = getCachedData<HomeLensListing[]>(cacheKey, { ttlMs: CACHE_TTL_MS });
      
      if (cached && isCacheValid(cached, CACHE_TTL_MS)) {
        console.log('[useFeaturedHomes] Serving from cache:', location);
        setListings(cached.data);
        setLocationLabel(location);
        setHasMore(cached.data.length >= 20);
        setIsLoading(false);
        return;
      }

      // If cache exists but is stale, show it while we refresh
      if (cached) {
        console.log('[useFeaturedHomes] Showing stale cache while refreshing:', location);
        setListings(cached.data);
        setLocationLabel(location);
        setHasMore(cached.data.length >= 20);
      }
    }

    // Check client-side rate limit using shared utility
    const rateLimit = checkRateLimit({
      maxRequests: MAX_REQUESTS_PER_WINDOW,
      windowMs: RATE_LIMIT_WINDOW_MS,
      storageKey: RATE_LIMIT_KEY,
    });
    
    if (!rateLimit.allowed) {
      console.log('[useFeaturedHomes] Client rate limit exceeded, using cached data');
      const cached = getCachedData<HomeLensListing[]>(cacheKey, { ttlMs: CACHE_TTL_MS });
      
      if (cached) {
        // Show stale cache if available
        setListings(cached.data);
        setLocationLabel(location);
        setHasMore(false);
        setIsLoading(false);
        
        const minutesUntilReset = Math.ceil(rateLimit.resetIn / 60000);
        toast({
          title: "Rate limit active",
          description: `Showing cached results. Fresh data available in ${minutesUntilReset} minute${minutesUntilReset > 1 ? 's' : ''}.`,
        });
        return;
      }
      
      // No cache available
      setError('Rate limit reached. Please try again in a few minutes.');
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);

      console.log(`[useFeaturedHomes] API call allowed. Remaining: ${rateLimit.remaining}`);

      const { data, error: fetchError } = await supabase.functions.invoke('search-listings', {
        body: {
          location,
          price_min: 200000,
          price_max: 1500000,
          offset: (pageNum - 1) * 20,
          limit: 20
        }
      });

      if (fetchError) throw fetchError;

      const newListings = data?.listings || [];
      
      if (append) {
        setListings(prev => [...prev, ...newListings]);
      } else {
        setListings(newListings);
        // Cache the fresh data using shared utility
        setCachedData(cacheKey, newListings);
      }

      setHasMore(newListings.length >= 20);
      setLocationLabel(location);
    } catch (err: any) {
      console.error('[useFeaturedHomes] Error fetching featured homes:', err);
      const errorMessage = err.message || 'Failed to load featured homes';
      setError(errorMessage);
      
      // Show toast for rate limit errors
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        toast({
          title: "Rate limit reached",
          description: "The property search API has reached its limit. Showing cached results.",
          variant: "destructive",
        });
        
        // Fall back to cached data
        const cached = getCachedData<HomeLensListing[]>(cacheKey, { ttlMs: CACHE_TTL_MS });
        if (cached) {
          setListings(cached.data);
          setLocationLabel(location);
          setHasMore(false);
          setError(null);
        }
      } else {
        // Try fallback location if this was the first attempt
        if (!append && pageNum === 1) {
          const fallbackLocation = DEFAULT_LOCATIONS.find(loc => loc !== location) || DEFAULT_LOCATIONS[0];
          if (fallbackLocation !== location) {
            await fetchListings(fallbackLocation, 1, false);
            return;
          }
        }
      }
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    const initialLocation = userPreferredArea || DEFAULT_LOCATIONS[0];
    fetchListings(initialLocation, 1, false);
  }, [userPreferredArea]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchListings(locationLabel, nextPage, true);
  };

  return {
    locationLabel,
    listings,
    isLoading,
    error,
    hasMore,
    loadMore
  };
}
