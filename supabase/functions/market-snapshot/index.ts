import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { retryWithBackoff } from '../_shared/http.ts';

const log = createLogger('market-snapshot');

const requestSchema = z.object({
  location_key: z.string().min(2).max(200),
  force_fresh: z.boolean().optional(),
});

function normalizeLocationKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const body = await req.json();
    const validationResult = requestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return validationError('Invalid input parameters', validationResult.error.errors);
    }
    
    const { location_key: rawLocationKey, force_fresh } = validationResult.data;
    const locationKey = normalizeLocationKey(rawLocationKey);
    
    log.step('Market snapshot request', { locationKey, force_fresh });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing snapshot
    if (!force_fresh) {
      const { data: existingSnapshot, error } = await supabase
        .from('market_snapshots')
        .select('*')
        .eq('location_key', locationKey)
        .maybeSingle();

      if (!error && existingSnapshot) {
        const age = Date.now() - new Date(existingSnapshot.updated_at).getTime();
        const ageHours = age / (1000 * 60 * 60);

        if (ageHours < 24) {
          log.step(`Returning cached snapshot (${ageHours.toFixed(1)}h old)`);
          return jsonResponse({ location_key: locationKey, snapshot: existingSnapshot.snapshot, source: 'cache', stale: false });
        }
      }
    }

    log.step('Fetching fresh market data');

    const RENTCAST_API_KEY = Deno.env.get('RENTCAST_API_KEY');
    const CENSUS_API_KEY = Deno.env.get('CENSUS_API_KEY');

    const snapshot: any = {
      location: rawLocationKey,
      generated_at: new Date().toISOString(),
      rentcast: null,
      census: null
    };

    // RentCast market data
    if (RENTCAST_API_KEY && /^\d{5}$/.test(rawLocationKey)) {
      try {
        const marketUrl = `https://api.rentcast.io/v1/markets?zipCode=${rawLocationKey}`;
        const marketResponse = await retryWithBackoff(async () => {
          const res = await fetch(marketUrl, { headers: { 'X-Api-Key': RENTCAST_API_KEY, 'Accept': 'application/json' } });
          if (!res.ok && (res.status === 429 || res.status >= 500)) {
            const error: any = new Error(`RentCast Market API error: ${res.status}`);
            error.status = res.status;
            throw error;
          }
          return res;
        });

        if (marketResponse.ok) {
          const marketData = await marketResponse.json();
          log.step('RentCast market data fetched');
          snapshot.rentcast = {
            median_rent: marketData.medianRent || null,
            median_home_value: marketData.medianListingPrice || null,
            rent_to_price_ratio: marketData.rentToPrice || null,
            price_change_1y: marketData.priceChange || null,
            rent_growth_1y: marketData.rentChange || null,
            avg_days_on_market: marketData.averageDaysOnMarket || null,
            trend_label: marketData.priceChange > 5 ? 'rising' : marketData.priceChange < -5 ? 'softening' : 'stable'
          };
        }
      } catch (e) {
        log.info('RentCast error:', (e as Error).message);
      }
    }

    // Census data
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
          log.step('Census data fetched');
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
        log.info('Census error:', (e as Error).message);
      }
    }

    // Save snapshot
    const { error: saveError } = await supabase
      .from('market_snapshots')
      .upsert({ location_key: locationKey, snapshot: snapshot, updated_at: new Date().toISOString() }, { onConflict: 'location_key' });

    if (saveError) {
      log.warn('Error saving snapshot:', saveError.message);
    } else {
      log.step('Snapshot saved to database');
    }

    return jsonResponse({ location_key: locationKey, snapshot: snapshot, source: 'fresh', stale: false });

  } catch (error) {
    log.error('Fatal error:', error);
    return errorResponse(getErrorMessage(error));
  }
});
