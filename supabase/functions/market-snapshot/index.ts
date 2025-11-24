import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location } = await req.json();
    const { zip, city, state } = location || {};

    if (!zip && (!city || !state)) {
      return new Response(
        JSON.stringify({ error: 'Must provide either zip or city+state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const areaLabel = zip || `${city}, ${state}`;
    let snapshot: any = {
      areaLabel,
      zip: zip || null,
      city: city || null,
      state: state || null,
      hasRentcastData: false,
      hasCensusData: false,
    };

    // RentCast API call
    const RENTCAST_API_KEY = Deno.env.get('RENTCAST_API_KEY');
    if (RENTCAST_API_KEY && zip) {
      try {
        const rentcastUrl = `https://api.rentcast.io/v1/markets/zip?zip_code=${zip}`;
        const rentcastResp = await fetch(rentcastUrl, {
          headers: { 'X-Api-Key': RENTCAST_API_KEY }
        });

        if (rentcastResp.ok) {
          const rentcastData = await rentcastResp.json();
          snapshot.medianRent = rentcastData.median_rent || null;
          snapshot.medianHomeValue = rentcastData.median_home_value || null;
          snapshot.rentToPriceRatio = rentcastData.rent_to_price_ratio || null;
          snapshot.trendLabel = rentcastData.trend_label || null;
          snapshot.hasRentcastData = !!(
            snapshot.medianRent ||
            snapshot.medianHomeValue ||
            snapshot.rentToPriceRatio
          );
        }
      } catch (error) {
        console.error('RentCast API error:', error);
      }
    }

    // Census API call
    const CENSUS_API_KEY = Deno.env.get('CENSUS_API_KEY');
    if (CENSUS_API_KEY && zip) {
      try {
        const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B25003_001E,B25003_002E,B25003_003E,B01002_001E,B25010_001E&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_API_KEY}`;
        const censusResp = await fetch(censusUrl);

        if (censusResp.ok) {
          const censusData = await censusResp.json();
          if (censusData && censusData.length > 1) {
            const [headers, values] = censusData;
            const medianIncome = parseFloat(values[0]);
            const totalUnits = parseFloat(values[1]);
            const ownerOccupied = parseFloat(values[2]);
            const renterOccupied = parseFloat(values[3]);
            const medianAge = parseFloat(values[4]);
            const avgHouseholdSize = parseFloat(values[5]);

            snapshot.medianHouseholdIncome = !isNaN(medianIncome) ? medianIncome : null;
            snapshot.ownerOccupiedRate = totalUnits > 0 ? ownerOccupied / totalUnits : null;
            snapshot.renterOccupiedRate = totalUnits > 0 ? renterOccupied / totalUnits : null;
            snapshot.medianAge = !isNaN(medianAge) ? medianAge : null;
            snapshot.averageHouseholdSize = !isNaN(avgHouseholdSize) ? avgHouseholdSize : null;
            snapshot.hasCensusData = !!(
              snapshot.medianHouseholdIncome ||
              snapshot.ownerOccupiedRate ||
              snapshot.renterOccupiedRate
            );
          }
        }
      } catch (error) {
        console.error('Census API error:', error);
      }
    }

    // Return null if no data from either API
    if (!snapshot.hasRentcastData && !snapshot.hasCensusData) {
      return new Response(
        JSON.stringify({ snapshot: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ snapshot }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('market-snapshot error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});