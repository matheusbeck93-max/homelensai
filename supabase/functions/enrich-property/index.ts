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
    const { address, city, state, zip } = await req.json();
    
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

        const rentcastResponse = await fetch(rentcastUrl, {
          headers: {
            'X-Api-Key': RENTCAST_API_KEY,
            'Accept': 'application/json',
          },
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
              const marketResponse = await fetch(marketUrl, {
                headers: {
                  'X-Api-Key': RENTCAST_API_KEY,
                  'Accept': 'application/json',
                },
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

        const censusResponse = await fetch(censusUrl);

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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
