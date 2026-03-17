import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  location_key: z.string().min(2).max(200),
  force_fresh: z.boolean().optional(),
});

// Normalize location key for consistent lookup
function normalizeLocationKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// Retry utility
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validationResult = requestSchema.safeParse(body);
    
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
    
    const { location_key: rawLocationKey, force_fresh } = validationResult.data;
    const locationKey = normalizeLocationKey(rawLocationKey);
    
    console.log('Market snapshot request:', { locationKey, force_fresh });

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing snapshot (if not force_fresh)
    if (!force_fresh) {
      const { data: existingSnapshot, error } = await supabase
        .from('market_snapshots')
        .select('*')
        .eq('location_key', locationKey)
        .maybeSingle();

      if (!error && existingSnapshot) {
        const age = Date.now() - new Date(existingSnapshot.updated_at).getTime();
        const ageHours = age / (1000 * 60 * 60);

        // Return cached if less than 24 hours old
        if (ageHours < 24) {
          console.log(`✅ Returning cached snapshot (${ageHours.toFixed(1)}h old)`);
          return new Response(
            JSON.stringify({ 
              location_key: locationKey,
              snapshot: existingSnapshot.snapshot,
              source: 'cache',
              stale: false
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Fetch fresh market data
    console.log('Fetching fresh market data...');

    const RENTCAST_API_KEY = Deno.env.get('RENTCAST_API_KEY');
    const CENSUS_API_KEY = Deno.env.get('CENSUS_API_KEY');

    const snapshot: any = {
      location: rawLocationKey,
      generated_at: new Date().toISOString(),
      rentcast: null,
      census: null
    };

    // RentCast market data (zip code based)
    if (RENTCAST_API_KEY && /^\d{5}$/.test(rawLocationKey)) {
      try {
        const marketUrl = `https://api.rentcast.io/v1/markets?zipCode=${rawLocationKey}`;
        
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
          console.log('RentCast market data fetched');
          
          snapshot.rentcast = {
            median_rent: marketData.medianRent || null,
            median_home_value: marketData.medianListingPrice || null,
            rent_to_price_ratio: marketData.rentToPrice || null,
            price_change_1y: marketData.priceChange || null,
            rent_growth_1y: marketData.rentChange || null,
            avg_days_on_market: marketData.averageDaysOnMarket || null,
            trend_label: marketData.priceChange > 5 ? 'rising' : 
                        marketData.priceChange < -5 ? 'softening' : 'stable'
          };
        }
      } catch (e) {
        console.log('RentCast error:', (e as Error).message);
      }
    }

    // Census data (zip code based)
    if (CENSUS_API_KEY && /^\d{5}$/.test(rawLocationKey)) {
      try {
        const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B25003_002E,B25003_003E,B01002_001E,B25010_001E,B25077_001E&for=zip%20code%20tabulation%20area:${rawLocationKey}&key=${CENSUS_API_KEY}`;
        
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
          console.log('Census data fetched');

          if (censusData && censusData.length > 1) {
            const data = censusData[1];
            const medianIncome = parseFloat(data[0]) || null;
            const ownerOccupied = parseFloat(data[1]) || null;
            const renterOccupied = parseFloat(data[2]) || null;
            const medianAge = parseFloat(data[3]) || null;
            const avgHouseholdSize = parseFloat(data[4]) || null;
            const medianHomeValue = parseFloat(data[5]) || null;

            const totalOccupied = (ownerOccupied || 0) + (renterOccupied || 0);

            snapshot.census = {
              median_household_income: medianIncome,
              median_home_value: medianHomeValue,
              owner_occupied_rate: totalOccupied > 0 && ownerOccupied !== null ? ownerOccupied / totalOccupied : null,
              renter_occupied_rate: totalOccupied > 0 && renterOccupied !== null ? renterOccupied / totalOccupied : null,
              median_age: medianAge,
              average_household_size: avgHouseholdSize,
            };
          }
        }
      } catch (e) {
        console.log('Census error:', (e as Error).message);
      }
    }

    // Save snapshot to database
    const { error: saveError } = await supabase
      .from('market_snapshots')
      .upsert({
        location_key: locationKey,
        snapshot: snapshot,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'location_key'
      });

    if (saveError) {
      console.log('Error saving snapshot:', saveError.message);
    } else {
      console.log('✅ Snapshot saved to database');
    }

    return new Response(
      JSON.stringify({ 
        location_key: locationKey,
        snapshot: snapshot,
        source: 'fresh',
        stale: false
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
