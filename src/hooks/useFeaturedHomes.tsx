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
    
    try {
      setIsLoading(true);
      setError(null);

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
          description: "The property search API has reached its limit. Please try again in a few minutes.",
          variant: "destructive",
        });
      }
      
      // Try fallback location if this was the first attempt
      if (!append && pageNum === 1 && !errorMessage.includes('rate limit')) {
        const fallbackLocation = DEFAULT_LOCATIONS.find(loc => loc !== location) || DEFAULT_LOCATIONS[0];
        if (fallbackLocation !== location) {
          await fetchListings(fallbackLocation, 1, false);
          return;
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
