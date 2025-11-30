import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema - allow empty location for default handling
const searchParamsSchema = z.object({
  location: z.string().max(200).optional().transform(val => val?.trim() || ''),
  price_min: z.number().min(0).optional(),
  price_max: z.number().max(100000000).optional(),
  beds_min: z.number().min(0).max(20).optional(),
  beds_max: z.number().min(0).max(20).optional(),
  baths_min: z.number().min(0).max(20).optional(),
  baths_max: z.number().min(0).max(20).optional(),
  prop_type: z.enum(['house', 'condo', 'townhome', 'multi', 'any']).optional(),
  force_fresh: z.boolean().optional(),
});

interface SearchParams {
  location?: string;
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  beds_max?: number;
  baths_min?: number;
  baths_max?: number;
  prop_type?: 'house' | 'condo' | 'townhome' | 'multi' | 'any';
  force_fresh?: boolean;
}

interface HomeLensListing {
  id: string;
  source: string;
  price: number | null;
  address: string;
  street: string;
  city: string;
  state: string;
  zipcode: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  status: string | null;
  dom: number | null;
  raw: any;
}

// Normalize query string for cache lookup
function normalizeQuery(params: SearchParams): string {
  const parts: string[] = [];
  
  if (params.location) parts.push(params.location.toLowerCase().replace(/[^a-z0-9]/g, '_'));
  if (params.beds_min) parts.push(`beds${params.beds_min}`);
  if (params.price_max) parts.push(`max${params.price_max}`);
  if (params.prop_type && params.prop_type !== 'any') parts.push(params.prop_type);
  
  return parts.join('_') || 'default';
}

// Retry utility with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable = error.status >= 500 || error.name === 'TypeError';
      
      if (attempt === maxRetries || !isRetryable) {
        throw error;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 5000);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Check cache for existing results
async function checkCache(
  supabase: any,
  normalizedQuery: string,
  forceFresh: boolean
): Promise<{ listings: HomeLensListing[], source: string, stale: boolean } | null> {
  if (forceFresh) {
    console.log('force_fresh=true, skipping cache');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('search_cache')
      .select('*')
      .eq('normalized_query', normalizedQuery)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('Cache lookup error:', error.message);
      return null;
    }

    if (!data) {
      console.log('No cache entry found');
      return null;
    }

    const cacheAge = Date.now() - new Date(data.created_at).getTime();
    const cacheAgeMinutes = Math.floor(cacheAge / 60000);
    const isStale = cacheAgeMinutes > (data.ttl_minutes || 15);

    console.log(`Cache entry found: ${cacheAgeMinutes}min old, ${isStale ? 'STALE' : 'FRESH'}`);

    if (!isStale) {
      return {
        listings: data.results || [],
        source: `cache (${data.source})`,
        stale: false
      };
    }

    return null;
  } catch (e) {
    console.log('Cache check error:', e);
    return null;
  }
}

// Save results to cache
async function saveToCache(
  supabase: any,
  normalizedQuery: string,
  params: SearchParams,
  source: string,
  results: HomeLensListing[]
) {
  try {
    const { error } = await supabase
      .from('search_cache')
      .upsert({
        normalized_query: normalizedQuery,
        params: params,
        source: source,
        results: results,
        ttl_minutes: 15,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'normalized_query'
      });

    if (error) {
      console.log('Cache save error:', error.message);
    } else {
      console.log(`Saved ${results.length} results to cache`);
    }
  } catch (e) {
    console.log('Cache save exception:', e);
  }
}

// Zillow56 API - PRIMARY PROVIDER
async function fetchFromZillow(params: SearchParams): Promise<HomeLensListing[]> {
  const ZILLOW_API_KEY = Deno.env.get('ZILLOW_API_KEY');
  
  if (!ZILLOW_API_KEY) {
    throw new Error('ZILLOW_API_KEY not configured');
  }

  console.log('🏠 Fetching from Zillow56 API...');

  const searchParams = new URLSearchParams();
  // Location is guaranteed to exist due to default handling above
  searchParams.append('location', params.location!);
  searchParams.append('output', 'json');
  searchParams.append('status', 'forSale');
  searchParams.append('sortSelection', 'priorityscore');
  searchParams.append('listing_type', 'by_agent');
  searchParams.append('doz', 'any');

  if (params.price_min) searchParams.append('price_min', params.price_min.toString());
  if (params.price_max) searchParams.append('price_max', params.price_max.toString());
  if (params.beds_min) searchParams.append('beds_min', params.beds_min.toString());
  if (params.beds_max) searchParams.append('beds_max', params.beds_max.toString());
  if (params.baths_min) searchParams.append('baths_min', params.baths_min.toString());
  if (params.baths_max) searchParams.append('baths_max', params.baths_max.toString());

  // Map prop_type to Zillow's home_type
  if (params.prop_type && params.prop_type !== 'any') {
    const typeMap: Record<string, string> = {
      'house': 'house',
      'condo': 'condo',
      'townhome': 'townhome',
      'multi': 'multi'
    };
    searchParams.append('home_type', typeMap[params.prop_type] || 'any');
  }

  const url = `https://zillow56.p.rapidapi.com/search?${searchParams.toString()}`;
  console.log('Zillow URL:', url);

  const response = await retryWithBackoff(async () => {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Host': 'zillow56.p.rapidapi.com',
        'X-RapidAPI-Key': ZILLOW_API_KEY
      }
    });

    if (!res.ok) {
      const error: any = new Error(`Zillow API failed: ${res.status}`);
      error.status = res.status;
      const errorText = await res.text();
      console.error('Zillow error response:', errorText);
      throw error;
    }

    return res;
  });

  const data = await response.json();
  console.log('Zillow response keys:', Object.keys(data));

  // Parse Zillow response structure
  const results = data.results || [];
  console.log(`Zillow returned ${results.length} properties`);

  // Normalize to HomeLens format
  const listings: HomeLensListing[] = results.map((item: any) => {
    const address = item.address || {};
    const fullAddress = `${address.streetAddress || ''}, ${address.city || ''}, ${address.state || ''} ${address.zipcode || ''}`.trim();

    return {
      id: item.zpid || `zillow-${Math.random().toString(36).substr(2, 9)}`,
      source: 'zillow',
      price: item.price || null,
      address: fullAddress || 'Address unavailable',
      street: address.streetAddress || '',
      city: address.city || '',
      state: address.state || '',
      zipcode: address.zipcode || '',
      beds: item.bedrooms || null,
      baths: item.bathrooms || null,
      sqft: item.livingArea || null,
      latitude: item.latitude || null,
      longitude: item.longitude || null,
      image_url: item.imgSrc || null,
      status: item.statusText || item.homeStatus || null,
      dom: item.daysOnZillow || null,
      raw: item
    };
  });

  return listings;
}

// Fallback: Return stale cache if available
async function getStaleCache(
  supabase: any,
  normalizedQuery: string
): Promise<{ listings: HomeLensListing[], source: string, stale: boolean } | null> {
  try {
    const { data, error } = await supabase
      .from('search_cache')
      .select('*')
      .eq('normalized_query', normalizedQuery)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.log('No stale cache available');
      return null;
    }

    console.log('✅ Returning stale cache as fallback');
    return {
      listings: data.results || [],
      source: `stale cache (${data.source})`,
      stale: true
    };
  } catch (e) {
    console.log('Stale cache error:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request
    const body = await req.json();
    const validationResult = searchParamsSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input parameters',
          details: validationResult.error.errors 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    let params = validationResult.data as SearchParams;
    
    // Apply default location if empty or missing
    const DEFAULT_LOCATION = "Miami, FL";
    if (!params.location || params.location.length < 2) {
      console.log('No valid location provided, using default:', DEFAULT_LOCATION);
      params.location = DEFAULT_LOCATION;
    }
    
    console.log('Search request:', params);

    // Initialize Supabase client for cache access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build normalized query for cache
    const normalizedQuery = normalizeQuery(params);
    console.log('Normalized query:', normalizedQuery);

    // 1. Check cache first
    const cachedResult = await checkCache(supabase, normalizedQuery, params.force_fresh || false);
    if (cachedResult) {
      console.log(`✅ Returning fresh cache (${cachedResult.listings.length} listings)`);
      return new Response(
        JSON.stringify({ 
          listings: cachedResult.listings,
          source: cachedResult.source,
          stale: false,
          normalized_query: normalizedQuery
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Try Zillow (PRIMARY)
    try {
      const zillowListings = await fetchFromZillow(params);
      
      if (zillowListings.length > 0) {
        console.log(`✅ Zillow success: ${zillowListings.length} listings`);
        
        // Save to cache
        await saveToCache(supabase, normalizedQuery, params, 'zillow', zillowListings);
        
        return new Response(
          JSON.stringify({ 
            listings: zillowListings,
            source: 'zillow',
            stale: false,
            normalized_query: normalizedQuery
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log('⚠️ Zillow returned 0 results');
      }
    } catch (zillowError: any) {
      console.error('❌ Zillow failed:', zillowError.message, `(status: ${zillowError.status})`);
      
      // If rate limited or failed, try stale cache
      if (zillowError.status === 429 || zillowError.status === 403 || zillowError.status >= 500) {
        const staleCacheResult = await getStaleCache(supabase, normalizedQuery);
        if (staleCacheResult) {
          return new Response(
            JSON.stringify({ 
              listings: staleCacheResult.listings,
              source: staleCacheResult.source,
              stale: true,
              message: 'Using cached results due to API rate limit',
              normalized_query: normalizedQuery
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 3. No results from Zillow and no cache - return empty gracefully
    console.log('❌ No results available from any source');
    return new Response(
      JSON.stringify({ 
        listings: [],
        source: 'none',
        stale: false,
        message: "We couldn't find properties matching your search right now. Try adjusting your filters or check back in a few minutes.",
        normalized_query: normalizedQuery
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error:', error);
    const err = error as Error;
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: err.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
