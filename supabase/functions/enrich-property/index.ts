import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { retryWithBackoff } from '../_shared/http.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const log = createLogger('enrich-property');

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
const RATE_LIMIT = { maxRequests: 60, windowMs: 60000 };

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

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // Get user ID for rate limiting
    const authHeader = req.headers.get('authorization');
    const userId = authHeader?.split('Bearer ')[1]?.substring(0, 36) || 'anonymous';
    
    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }
    
    // Parse and validate request body
    const body = await req.json();
    const validationResult = enrichParamsSchema.safeParse(body);
    
    if (!validationResult.success) {
      return validationError('Invalid input parameters', validationResult.error.errors);
    }
    
    const { address, city, state, zip } = validationResult.data;
    
    const RENTCAST_API_KEY = Deno.env.get('RENTCAST_API_KEY');
    const CENSUS_API_KEY = Deno.env.get('CENSUS_API_KEY');

    log.info(`Enriching property: ${address}, ${city}, ${state} ${zip}`);

    const insights: any = {};

    // 1)(req))) RentCast API - Rent estimates and market data
    if (RENTCAST_API_KEY) {
      try {
        const rentcastParams = new URLSearchParams({
          address: address || '',
          city: city || '',
          state: state || '',
          zipCode: zip || '',
        });

        const rentcastUrl = `https://api.rentcast.io/v1/avm/rent?${rentcastParams}`;
        log.info('Calling RentCast API:', rentcastUrl);

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
        }, 3);

        if (rentcastResponse.ok) {
          const rentData = await rentcastResponse.json();
          log.info('RentCast data received:', rentData);

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
              }, 3);

              if (marketResponse.ok) {
                const marketData = await marketResponse.json();
                log.info('RentCast market data:', marketData);
                
                insights.rentcast.zip_market_summary = {
                  median_rent: marketData.medianRent || null,
                  median_home_value: marketData.medianListingPrice || null,
                  rent_to_price_ratio: marketData.rentToPrice || null,
                  trend_label: marketData.priceChange > 5 ? 'rising' : 
                               marketData.priceChange < -5 ? 'softening' : 'stable',
                };
              }
            } catch (e) {
              log.info('RentCast market data error:', (e as Error).message);
            }
          }
        } else {
          log.info('RentCast API error:', await rentcastResponse.text());
        }
      } catch (e) {
        log.info('RentCast error:', (e as Error).message);
        insights.rentcast = null;
      }
    }

    // 2) US Census Bureau API - Demographics
    if (CENSUS_API_KEY && zip) {
      try {
        const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B25003_002E,B25003_003E,B01002_001E,B25010_001E&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_API_KEY}`;
        
        log.info('Calling Census API for ZIP:', zip);

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
          log.info('Census data received:', censusData);

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
          log.info('Census API error:', await censusResponse.text());
        }
      } catch (e) {
        log.info('Census error:', (e as Error).message);
        insights.census = null;
      }
    }

    log.info('Final insights:', insights);

    return jsonResponse(
      { insights },
      200,
    );
  } catch (error) {
    log.error('Error enriching property:', error);
    return errorResponse(getErrorMessage(error));
  }
});
