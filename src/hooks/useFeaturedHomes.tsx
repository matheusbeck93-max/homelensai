import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HomeLensListing } from '@/types/ui-blocks';
import { useToast } from '@/hooks/use-toast';

type FeaturedHomesState = {
  locationLabel: string;
  listings: HomeLensListing[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
};

const DEFAULT_LOCATIONS = ['Miami, FL', 'Austin, TX', 'Phoenix, AZ'];

// Cache configuration
const CACHE_KEY_PREFIX = 'homelens_featured_homes_';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 2;
const RATE_LIMIT_STORAGE_KEY = 'homelens_api_rate_limit';

interface CachedData {
  listings: HomeLensListing[];
  timestamp: number;
  location: string;
}

interface RateLimitData {
  count: number;
  resetTime: number;
}

// Cache helpers
function getCachedListings(location: string): CachedData | null {
  try {
    const key = CACHE_KEY_PREFIX + location;
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    return JSON.parse(cached) as CachedData;
  } catch {
    return null;
  }
}

function setCachedListings(location: string, listings: HomeLensListing[]) {
  try {
    const key = CACHE_KEY_PREFIX + location;
    const data: CachedData = {
      listings,
      timestamp: Date.now(),
      location
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to cache listings:', err);
  }
}

function isCacheValid(cachedData: CachedData | null): boolean {
  if (!cachedData) return false;
  const age = Date.now() - cachedData.timestamp;
  return age < CACHE_TTL_MS;
}

// Rate limit helpers
function checkClientRateLimit(): { allowed: boolean; remaining: number; resetTime: number } {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    const now = Date.now();
    
    if (!stored) {
      // First request
      const rateLimitData: RateLimitData = {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW_MS
      };
      localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(rateLimitData));
      return {
        allowed: true,
        remaining: MAX_REQUESTS_PER_WINDOW - 1,
        resetTime: rateLimitData.resetTime
      };
    }

    const rateLimitData: RateLimitData = JSON.parse(stored);

    // Reset if window expired
    if (now > rateLimitData.resetTime) {
      const newData: RateLimitData = {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW_MS
      };
      localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(newData));
      return {
        allowed: true,
        remaining: MAX_REQUESTS_PER_WINDOW - 1,
        resetTime: newData.resetTime
      };
    }

    // Check if limit exceeded
    if (rateLimitData.count >= MAX_REQUESTS_PER_WINDOW) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: rateLimitData.resetTime
      };
    }

    // Increment count
    rateLimitData.count++;
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(rateLimitData));
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - rateLimitData.count,
      resetTime: rateLimitData.resetTime
    };
  } catch {
    // On error, allow the request
    return { allowed: true, remaining: 1, resetTime: Date.now() + RATE_LIMIT_WINDOW_MS };
  }
}

export function useFeaturedHomes(userPreferredArea?: string | null): FeaturedHomesState {
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [listings, setListings] = useState<HomeLensListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { toast } = useToast();

  const fetchListings = async (location: string, pageNum: number = 1, append: boolean = false) => {
    // Prevent duplicate concurrent calls
    if (isLoading && !append) {
      console.log('Search already in progress, skipping duplicate call');
      return;
    }

    // Check cache first (only for initial load)
    if (!append && pageNum === 1) {
      const cached = getCachedListings(location);
      
      if (cached && isCacheValid(cached)) {
        console.log('Serving from cache:', location);
        setListings(cached.listings);
        setLocationLabel(location);
        setHasMore(cached.listings.length >= 20);
        setIsLoading(false);
        return;
      }

      // If cache exists but is stale, show it while we refresh
      if (cached) {
        console.log('Showing stale cache while refreshing:', location);
        setListings(cached.listings);
        setLocationLabel(location);
        setHasMore(cached.listings.length >= 20);
      }
    }

    // Check client-side rate limit
    const rateLimit = checkClientRateLimit();
    if (!rateLimit.allowed) {
      console.log('Client rate limit exceeded, using cached data');
      const cached = getCachedListings(location);
      
      if (cached) {
        // Show stale cache if available
        setListings(cached.listings);
        setLocationLabel(location);
        setHasMore(false);
        setIsLoading(false);
        
        const minutesUntilReset = Math.ceil((rateLimit.resetTime - Date.now()) / 60000);
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

      console.log(`API call allowed. Remaining: ${rateLimit.remaining}`);

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
        // Cache the fresh data
        setCachedListings(location, newListings);
      }

      setHasMore(newListings.length >= 20);
      setLocationLabel(location);
    } catch (err: any) {
      console.error('Error fetching featured homes:', err);
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
        const cached = getCachedListings(location);
        if (cached) {
          setListings(cached.listings);
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
