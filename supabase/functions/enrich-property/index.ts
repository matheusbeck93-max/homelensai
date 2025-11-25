import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const enrichParamsSchema = z.object({
  address: z.string().min(5).max(200),
  city: z.string().min(1).max(100).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().min(5).max(10),
});

// Rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT = { maxRequests: 60, windowMs: 60000 }; // 60 requests per minute

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

// Retry utility
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
            'Retry-After': '60'
          } 
        }
      );
    }
    
    // Parse and validate request body
    const body = await req.json();
    const validationResult = enrichParamsSchema.safeParse(body);
    
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
    
    const { address, city, state, zip } = validationResult.data;
    
    const RENTCAST_API_KEY = Deno.env.get('RENTCAST_API_KEY');
    const CENSUS_API_KEY = Deno.env.get('CENSUS_API_KEY');

    console.log(`Enriching property: ${address}, ${city}, ${state} ${zip}`);

    const insights: any = {};

    // 1) RentCast API - Rent estimates and market data
    if (RENTCAST_API_KEY) {
      try {
        const rentcastParams = new URLSearchParams({
          address: address || '',
          city: city || '',
          state: state || '',
          zipCode: zip || '',
        });

        const rentcastUrl = `https://api.rentcast.io/v1/avm/rent?${rentcastParams}`;
        console.log('Calling RentCast API:', rentcastUrl);

        // Fetch with retry logic
        const rentcastResponse = await retryWithBackoff(async () => {
          const res = await fetch(rentcastUrl, {
            headers: {
              'X-Api-Key': RENTCAST_API_KEY,
              'Accept': 'application/json',
            },
          });
          if (!res.ok && (res.status === 429 || res.status >= 500)) {
            const error: any = new Error(`RentCast API error: ${res.status}`);
            error.status = res.status;
            throw error;
          }
          return res;
        });

        if (rentcastResponse.ok) {
          const rentData = await rentcastResponse.json();
          console.log('RentCast data received:', rentData);

          insights.rentcast = {
            rent_estimate: rentData.rent || null,
            rent_low: rentData.rentRangeLow || null,
            rent_high: rentData.rentRangeHigh || null,
            value_estimate: rentData.price || null,
            confidence: rentData.confidence || null,
          };

          // Try to get ZIP market summary
          if (zip) {
            try {
              const marketUrl = `https://api.rentcast.io/v1/markets?zipCode=${zip}`;
              const marketResponse = await retryWithBackoff(async () => {
                const res = await fetch(marketUrl, {
                  headers: {
                    'X-Api-Key': RENTCAST_API_KEY,
                    'Accept': 'application/json',
                  },
                });
                if (!res.ok && (res.status === 429 || res.status >= 500)) {
                  const error: any = new Error(`RentCast Market API error: ${res.status}`);
                  error.status = res.status;
                  throw error;
                }
                return res;
              });

              if (marketResponse.ok) {
                const marketData = await marketResponse.json();
                console.log('RentCast market data:', marketData);
                
                insights.rentcast.zip_market_summary = {
                  median_rent: marketData.medianRent || null,
                  median_home_value: marketData.medianListingPrice || null,
                  rent_to_price_ratio: marketData.rentToPrice || null,
                  trend_label: marketData.priceChange > 5 ? 'rising' : 
                               marketData.priceChange < -5 ? 'softening' : 'stable',
                };
              }
            } catch (e) {
              const error = e as Error;
              console.log('RentCast market data error:', error.message);
            }
          }
        } else {
          console.log('RentCast API error:', await rentcastResponse.text());
        }
      } catch (e) {
        const error = e as Error;
        console.log('RentCast error:', error.message);
        insights.rentcast = null;
      }
    }

    // 2) US Census Bureau API - Demographics
    if (CENSUS_API_KEY && zip) {
      try {
        // Using ACS 5-Year estimates for ZIP Code Tabulation Areas (ZCTA)
        const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B25003_002E,B25003_003E,B01002_001E,B25010_001E&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_API_KEY}`;
        
        console.log('Calling Census API for ZIP:', zip);

        // Fetch with retry logic
        const censusResponse = await retryWithBackoff(async () => {
          const res = await fetch(censusUrl);
          if (!res.ok && (res.status === 429 || res.status >= 500)) {
            const error: any = new Error(`Census API error: ${res.status}`);
            error.status = res.status;
            throw error;
          }
          return res;
        });

        if (censusResponse.ok) {
          const censusData = await censusResponse.json();
          console.log('Census data received:', censusData);

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
        } else {
          console.log('Census API error:', await censusResponse.text());
        }
      } catch (e) {
        const error = e as Error;
        console.log('Census error:', error.message);
        insights.census = null;
      }
    }

    console.log('Final insights:', insights);

    return new Response(
      JSON.stringify({ insights }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString()
        } 
      }
    );
  } catch (error) {
    console.error('Error enriching property:', error);
    const err = error as Error;
    return new Response(
      JSON.stringify({ error: err.message, insights: {} }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
