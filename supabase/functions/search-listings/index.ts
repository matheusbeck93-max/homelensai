import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const searchParamsSchema = z.object({
  location: z.string().min(2).max(200).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().max(100000000).optional(),
  minBeds: z.number().min(0).max(20).optional(),
  maxBeds: z.number().min(0).max(20).optional(),
  propertyType: z.enum(['house', 'condo', 'townhome', 'multi', 'any']).optional(),
});

// Rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT = { maxRequests: 30, windowMs: 60000 }; // 30 requests per minute

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);
  
  if (entry && now > entry.resetTime) {
    rateLimitStore.delete(userId);
  }
  
  const currentEntry = rateLimitStore.get(userId);
  
  if (!currentEntry) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }
  
  if (currentEntry.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  
  currentEntry.count++;
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - currentEntry.count };
}

// Retry utility with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable = error.status === 429 || error.status >= 500 || error.name === 'TypeError';
      
      if (attempt === maxRetries || !isRetryable) {
        throw error;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

interface SearchParams {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  propertyType?: 'house' | 'condo' | 'townhome' | 'multi' | 'any';
}

// Complete US state name → state code mapping
const STATE_MAP: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
  "colorado": "CO", "connecticut": "CT", "delaware": "DE", "district of columbia": "DC",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL",
  "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA",
  "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI",
  "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT",
  "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
  "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
  "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI",
  "wyoming": "WY"
};

function parseLocation(raw?: string): {
  city?: string;
  stateCode?: string;
  postalCode?: string;
} {
  if (!raw) return {};
  const value = raw.trim().replace(/\s+/g, " ");

  if (/^\d{5}$/.test(value)) {
    return { postalCode: value };
  }

  let cityPart = "";
  let statePart = "";

  if (value.includes(",")) {
    const [city, state] = value.split(",").map(s => s.trim());
    cityPart = city;
    statePart = state;
  } else {
    const parts = value.split(" ");
    if (parts.length > 1) {
      const lastWord = parts[parts.length - 1];
      
      if (lastWord.length === 2) {
        statePart = lastWord;
        cityPart = parts.slice(0, -1).join(" ");
      } else {
        const stateKey = lastWord.toLowerCase();
        if (STATE_MAP[stateKey]) {
          statePart = lastWord;
          cityPart = parts.slice(0, -1).join(" ");
        } else {
          if (parts.length > 2) {
            const lastTwoWords = parts.slice(-2).join(" ").toLowerCase();
            if (STATE_MAP[lastTwoWords]) {
              statePart = parts.slice(-2).join(" ");
              cityPart = parts.slice(0, -2).join(" ");
            } else {
              cityPart = value;
            }
          } else {
            cityPart = value;
          }
        }
      }
    } else {
      cityPart = value;
    }
  }

  let stateCode = "";
  if (statePart) {
    if (statePart.length === 2) {
      stateCode = statePart.toUpperCase();
    } else {
      const key = statePart.toLowerCase();
      stateCode = STATE_MAP[key] || "";
    }
  }

  return {
    city: cityPart || undefined,
    stateCode: stateCode || undefined,
  };
}

interface HomeLensListing {
  id: string;
  address: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photoUrl: string | null;
  listingUrl: string | null;
  status: string | null;
  source: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  insights?: {
    rentcast?: {
      rent_estimate?: number | null;
      rent_low?: number | null;
      rent_high?: number | null;
      value_estimate?: number | null;
      confidence?: string | null;
      zip_market_summary?: {
        median_rent?: number | null;
        median_home_value?: number | null;
        rent_to_price_ratio?: number | null;
        trend_label?: string | null;
      } | null;
    };
    census?: {
      median_household_income?: number | null;
      owner_occupied_rate?: number | null;
      renter_occupied_rate?: number | null;
      median_age?: number | null;
      average_household_size?: number | null;
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user ID for rate limiting
    const authHeader = req.headers.get('authorization');
    const userId = authHeader?.split('Bearer ')[1]?.substring(0, 36) || 'anonymous';
    
    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: 60 
        }),
        { 
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60'
          } 
        }
      );
    }
    
    // Parse and validate request body
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
    
    const { location, minPrice, maxPrice, minBeds, maxBeds, propertyType } = validationResult.data as SearchParams;

    console.log('Search request:', { location, minPrice, maxPrice, minBeds, maxBeds, propertyType });

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    
    if (!rapidApiKey) {
      console.error('RAPIDAPI_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'API key not configured',
          details: 'Please configure your RapidAPI key in the project settings.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const DEFAULT_AREA = "Miami, FL";
    const rawLocation = location && location.trim().length > 0 ? location : DEFAULT_AREA;
    const { city, stateCode, postalCode } = parseLocation(rawLocation);

    const requestBody: any = {
      limit: 60,
      offset: 0,
      status: ["for_sale", "ready_to_build"],
      sort: {
        direction: "desc",
        field: "list_date"
      }
    };

    if (postalCode) {
      requestBody.postal_code = postalCode;
    } else {
      if (city) requestBody.city = city;
      if (stateCode) requestBody.state_code = stateCode;
    }

    console.log('Parsed location:', { city, stateCode, postalCode });

    requestBody.price_min = minPrice ?? 0;
    requestBody.price_max = maxPrice ?? 2000000;

    if (minBeds) requestBody.beds_min = minBeds;
    if (maxBeds) requestBody.beds_max = maxBeds;

    if (propertyType && propertyType !== 'any') {
      const typeMap: Record<string, string> = {
        'house': 'single_family',
        'condo': 'condo',
        'townhome': 'townhomes',
        'multi': 'multi_family'
      };
      requestBody.prop_type = [typeMap[propertyType] || 'single_family'];
    }

    console.log('Calling Realty in US API with body:', JSON.stringify(requestBody, null, 2));

    // Make API call with retry logic
    const response = await retryWithBackoff(async () => {
      const res = await fetch('https://realty-in-us.p.rapidapi.com/properties/v3/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'realty-in-us.p.rapidapi.com'
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const error: any = new Error(`API request failed: ${res.status}`);
        error.status = res.status;
        throw error;
      }

      return res;
    });

    const data = await response.json();
    console.log('Realtor API response received, data keys:', Object.keys(data));

    const properties = data?.data?.home_search?.results || data?.data?.results || data?.results || [];
    console.log('Properties count before filtering:', properties.length);

    let listings: HomeLensListing[] = properties.map((prop: any) => {
      const location = prop.location || {};
      const address = location.address || {};
      const coordinate = address.coordinate || location.coordinate || {};
      const description = prop.description || {};
      
      return {
        id: prop.property_id || prop.listing_id || `prop-${Math.random().toString(36).substr(2, 9)}`,
        address: `${address.line || ''}, ${address.city || ''}, ${address.state_code || ''} ${address.postal_code || ''}`.trim() || 'Address unavailable',
        price: prop.list_price || prop.price || null,
        beds: description.beds || prop.beds || null,
        baths: description.baths || prop.baths || null,
        sqft: description.sqft || prop.sqft || description.building_size?.size || null,
        photoUrl: prop.primary_photo?.href || prop.thumbnail || prop.photos?.[0]?.href || null,
        listingUrl: prop.href || prop.rdc_web_url || null,
        status: prop.status || 'for_sale',
        source: 'realtor',
        city: address.city || null,
        state: address.state_code || null,
        zip: address.postal_code || null,
        lat: coordinate.lat ?? null,
        lng: coordinate.lon ?? null,
        insights: null, // Will be enriched below
      };
    });

    // Enrich properties with RentCast and Census data (for first 20 properties to avoid API limits)
    const RENTCAST_API_KEY = Deno.env.get('RENTCAST_API_KEY');
    const CENSUS_API_KEY = Deno.env.get('CENSUS_API_KEY');
    
    if ((RENTCAST_API_KEY || CENSUS_API_KEY) && listings.length > 0) {
      console.log(`Enriching first ${Math.min(listings.length, 20)} properties with API data...`);
      
      const enrichmentPromises = listings.slice(0, 20).map(async (listing) => {
        if (!listing.zip) return listing;
        
        try {
          const insights: any = {};
          
          // RentCast API call
          if (RENTCAST_API_KEY) {
            try {
              const rentcastParams = new URLSearchParams({
                address: listing.address || '',
                city: listing.city || '',
                state: listing.state || '',
                zipCode: listing.zip || '',
              });
              
              const rentcastUrl = `https://api.rentcast.io/v1/avm/rent?${rentcastParams}`;
              const rentcastResponse = await fetch(rentcastUrl, {
                headers: {
                  'X-Api-Key': RENTCAST_API_KEY,
                  'Accept': 'application/json',
                },
              });
              
              if (rentcastResponse.ok) {
                const rentData = await rentcastResponse.json();
                insights.rentcast = {
                  rent_estimate: rentData.rent || null,
                  rent_low: rentData.rentRangeLow || null,
                  rent_high: rentData.rentRangeHigh || null,
                  value_estimate: rentData.price || null,
                  confidence: rentData.confidence || null,
                };
                
                // Get market summary
                const marketUrl = `https://api.rentcast.io/v1/markets?zipCode=${listing.zip}`;
                const marketResponse = await fetch(marketUrl, {
                  headers: {
                    'X-Api-Key': RENTCAST_API_KEY,
                    'Accept': 'application/json',
                  },
                });
                
                if (marketResponse.ok) {
                  const marketData = await marketResponse.json();
                  insights.rentcast.zip_market_summary = {
                    median_rent: marketData.medianRent || null,
                    median_home_value: marketData.medianListingPrice || null,
                    rent_to_price_ratio: marketData.rentToPrice || null,
                    trend_label: marketData.priceChange > 5 ? 'rising' : 
                                 marketData.priceChange < -5 ? 'softening' : 'stable',
                  };
                }
              }
            } catch (e) {
              console.log(`RentCast enrichment failed for ${listing.id}:`, (e as Error).message);
            }
          }
          
          // Census API call
          if (CENSUS_API_KEY) {
            try {
              const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B25003_002E,B25003_003E,B01002_001E,B25010_001E&for=zip%20code%20tabulation%20area:${listing.zip}&key=${CENSUS_API_KEY}`;
              const censusResponse = await fetch(censusUrl);
              
              if (censusResponse.ok) {
                const censusData = await censusResponse.json();
                if (censusData && censusData.length > 1) {
                  const data = censusData[1];
                  const medianIncome = parseFloat(data[0]) || null;
                  const ownerOccupied = parseFloat(data[1]) || null;
                  const renterOccupied = parseFloat(data[2]) || null;
                  const medianAge = parseFloat(data[3]) || null;
                  const avgHouseholdSize = parseFloat(data[4]) || null;
                  const totalOccupied = (ownerOccupied || 0) + (renterOccupied || 0);
                  
                  insights.census = {
                    median_household_income: medianIncome,
                    owner_occupied_rate: totalOccupied > 0 && ownerOccupied !== null ? ownerOccupied / totalOccupied : null,
                    renter_occupied_rate: totalOccupied > 0 && renterOccupied !== null ? renterOccupied / totalOccupied : null,
                    median_age: medianAge,
                    average_household_size: avgHouseholdSize,
                  };
                }
              }
            } catch (e) {
              console.log(`Census enrichment failed for ${listing.id}:`, (e as Error).message);
            }
          }
          
          const enrichedListing: HomeLensListing = { 
            ...listing, 
            insights: Object.keys(insights).length > 0 ? insights : undefined 
          };
          return enrichedListing;
        } catch (error) {
          console.log(`Failed to enrich property ${listing.id}:`, (error as Error).message);
          return listing;
        }
      });
      
      const enrichedListings = await Promise.all(enrichmentPromises);
      
      // Replace first 20 with enriched versions
      listings = [
        ...enrichedListings,
        ...listings.slice(20)
      ];
      
      console.log(`Enrichment complete. ${enrichedListings.filter(l => l.insights).length} properties enriched.`);
    }

    if (stateCode) {
      const beforeFilter = listings.length;
      listings = listings.filter(listing => {
        const listingState = listing.state?.toUpperCase();
        const requestedState = stateCode.toUpperCase();
        return listingState === requestedState;
      });
      const afterFilter = listings.length;
      console.log(`State filter applied: ${beforeFilter} -> ${afterFilter} (requested: ${stateCode})`);
      
      if (afterFilter === 0 && beforeFilter > 0) {
        console.warn(`All ${beforeFilter} results filtered out - they were from wrong states`);
      }
    }

    console.log('Returning filtered normalized listings:', listings.length);

    return new Response(
      JSON.stringify({ listings }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString()
        } 
      }
    );

  } catch (error) {
    console.error('Error in search-listings function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
