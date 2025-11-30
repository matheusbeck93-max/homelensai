import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema - allow empty location for default handling
const searchParamsSchema = z.object({
  query: z.string().optional(),
  location: z.string().max(200).optional().transform(val => val?.trim() || ''),
  price_min: z.number().min(0).optional(),
  price_max: z.number().max(100000000).optional(),
  beds_min: z.number().min(0).max(20).optional(),
  baths_min: z.number().min(0).max(20).optional(),
  prop_type: z.enum(['house', 'condo', 'townhome', 'multi', 'any']).optional(),
  page: z.number().min(1).optional(),
  force_fresh: z.boolean().optional(),
});

interface SearchParams {
  query?: string;
  location?: string;
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  baths_min?: number;
  prop_type?: 'house' | 'condo' | 'townhome' | 'multi' | 'any';
  page?: number;
  force_fresh?: boolean;
}

// Normalized Property interface matching frontend
interface Property {
  id: string;
  source: "zillow";
  zpid?: string;
  externalUrl?: string;
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
  raw?: any;
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
): Promise<{ listings: Property[], source: string, stale: boolean } | null> {
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
  results: Property[]
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
async function fetchFromZillow(params: SearchParams): Promise<{ listings: Property[], pagination: any }> {
  const apiKey = Deno.env.get('ZILLOW_API_KEY');
  
  if (!apiKey) {
    const error: any = new Error('ZILLOW_API_KEY not configured');
    error.status = 401;
    throw error;
  }

  const host = 'zillow56.p.rapidapi.com';
  const keyTail = apiKey.slice(-4);
  console.log(`[search-listings] Preparing Zillow request host=${host} apiKeyTail=${keyTail}`);
  console.log('[search-listings] 🏠 Fetching from Zillow56 API...');

  const searchParams = new URLSearchParams();
  searchParams.append('location', params.location!);
  searchParams.append('output', 'json');
  searchParams.append('status', 'forSale');

  if (params.price_min) searchParams.append('price_min', params.price_min.toString());
  if (params.price_max) searchParams.append('price_max', params.price_max.toString());
  if (params.beds_min) searchParams.append('beds', params.beds_min.toString());
  if (params.baths_min) searchParams.append('baths', params.baths_min.toString());

  // Map prop_type (if not 'any')
  if (params.prop_type && params.prop_type !== 'any') {
    searchParams.append('home_type', params.prop_type);
  }

  const url = `https://${host}/search?${searchParams.toString()}`;

  const response = await retryWithBackoff(async () => {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Host': host,
        'X-RapidAPI-Key': apiKey,
      }
    });

    if (!res.ok) {
      const error: any = new Error(`Zillow API failed: ${res.status}`);
      error.status = res.status;
      const errorText = await res.text();
      console.error('[search-listings] Zillow error response:', errorText);
      throw error;
    }

    return res;
  });

  const zillowJson = await response.json();
  const zResults = zillowJson.results ?? [];

  console.log(`[search-listings] zillow status=ok count=${zResults.length}`);
  
  // Log first property for debugging
  if (zResults.length > 0) {
    console.log('[search-listings] Sample property:', JSON.stringify({
      zpid: zResults[0].zpid,
      streetAddress: zResults[0].streetAddress,
      city: zResults[0].city,
      state: zResults[0].state,
      zipcode: zResults[0].zipcode,
      price: zResults[0].price,
      bedrooms: zResults[0].bedrooms,
      bathrooms: zResults[0].bathrooms,
      livingArea: zResults[0].livingArea,
      imgSrc: zResults[0].imgSrc,
      latitude: zResults[0].latitude,
      longitude: zResults[0].longitude,
      zestimate: zResults[0].zestimate,
      rentZestimate: zResults[0].rentZestimate
    }, null, 2));
  }

  // Helper function to calculate price fairness
  function calculatePriceFairness(price: number, zestimate: number | undefined): { score: number; level: string } {
    if (!zestimate || zestimate <= 0) {
      return { score: 50, level: 'fair' };
    }

    const percentDiff = ((price - zestimate) / zestimate) * 100;
    
    let score: number;
    let level: string;

    if (percentDiff < -15) {
      score = 90;
      level = 'very_underpriced';
    } else if (percentDiff < -5) {
      score = 75;
      level = 'underpriced';
    } else if (percentDiff <= 10) {
      score = 50;
      level = 'fair';
    } else if (percentDiff <= 25) {
      score = 25;
      level = 'overpriced';
    } else {
      score = 10;
      level = 'very_overpriced';
    }

    return { score, level };
  }

  // Map to normalized Property format
  const listings: Property[] = zResults.map((item: any) => {
    const price = item.price ?? item.priceForHDP ?? 0;
    const sqft = item.livingArea;
    const zestimate = item.zestimate;
    const fairness = calculatePriceFairness(price, zestimate);
    const zpid = item.zpid ? String(item.zpid) : undefined;

    // Build external URL - prefer API-provided URLs, fallback to constructing from zpid
    const zillowUrlFromApi = item.detailUrl || item.hdpUrl || item.url || item.detailUrlPath || null;
    const fallbackUrl = zpid ? `https://www.zillow.com/homedetails/${zpid}_zpid/` : null;
    const externalUrl = zillowUrlFromApi
      ? (zillowUrlFromApi.startsWith("http") ? zillowUrlFromApi : `https://www.zillow.com${zillowUrlFromApi}`)
      : fallbackUrl;

    return {
      id: zpid ?? String(item.zpid),
      source: "zillow" as const,
      zpid: zpid,
      externalUrl: externalUrl ?? undefined,
      address: item.streetAddress ?? "",
      city: item.city ?? "",
      state: item.state ?? "",
      zip: item.zipcode ?? "",
      latitude: item.latitude,
      longitude: item.longitude,
      price: price,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      sqft: sqft,
      lotSize: item.lotAreaValue,
      propertyType: item.homeType,
      status: item.homeStatus ?? item.homeStatusForHDP ?? "FOR_SALE",
      imageUrl: item.imgSrc,
      zestimate: zestimate,
      rentZestimate: item.rentZestimate,
      taxAssessedValue: item.taxAssessedValue,
      pricePerSqft: sqft && price ? Math.round(price / sqft) : undefined,
      fairPriceScore: fairness.score,
      fairPriceLevel: fairness.level as any,
      raw: item
    };
  });

  const pagination = {
    totalResults: zillowJson.totalResultCount ?? listings.length,
    resultsPerPage: zillowJson.resultsPerPage ?? listings.length,
    totalPages: zillowJson.totalPages ?? 1
  };

  return { listings, pagination };
}

// Fallback: Return stale cache if available
async function getStaleCache(
  supabase: any,
  normalizedQuery: string
): Promise<{ listings: Property[], source: string, stale: boolean } | null> {
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
      const { listings, pagination } = await fetchFromZillow(params);
      
      if (listings.length > 0) {
        // Save to cache
        await saveToCache(supabase, normalizedQuery, params, 'zillow', listings);
        
        return new Response(
          JSON.stringify({ 
            source: 'zillow',
            status: 'ok',
            listings,
            pagination
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log('[search-listings] ⚠️ Zillow returned 0 results');
      }
    } catch (zillowError: any) {
      const status = zillowError.status;
      
      // Handle auth/subscription errors (403, 401)
      if (status === 403 || status === 401) {
        console.log(`[search-listings] zillow status=unavailable reason=auth_or_subscription`);
        return new Response(
          JSON.stringify({
            source: 'zillow',
            status: 'unavailable',
            reason: 'auth_or_subscription',
            listings: []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle rate limit / server errors (429, 5xx)
      if (status === 429 || status >= 500) {
        console.log(`[search-listings] zillow status=unavailable reason=temporary_error`);
        
        // Try stale cache as fallback
        const staleCacheResult = await getStaleCache(supabase, normalizedQuery);
        if (staleCacheResult) {
          return new Response(
            JSON.stringify({
              source: 'stale cache',
              status: 'ok',
              listings: staleCacheResult.listings,
              message: 'Using cached results due to temporary API error'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            source: 'zillow',
            status: 'unavailable',
            reason: 'temporary_error',
            listings: []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Network or other errors
      console.error('[search-listings] Zillow error:', zillowError.message);
    }

    // 3. No results available
    console.log('[search-listings] ❌ No results available from any source');
    return new Response(
      JSON.stringify({ 
        source: 'none',
        status: 'unavailable',
        listings: [],
        message: "No listings available right now. Please try again later."
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
