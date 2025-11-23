import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchParams {
  location?: string; // "City, ST" or ZIP code
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

// Robust location parser supporting multiple formats:
// - "Arlington, VA" (comma-separated)
// - "Arlington Virginia" (space-separated with full state name)
// - "22201" (ZIP code)
// - "City ST" (space-separated with state abbreviation)
function parseLocation(raw?: string): {
  city?: string;
  stateCode?: string;
  postalCode?: string;
} {
  if (!raw) return {};
  const value = raw.trim().replace(/\s+/g, " ");

  // Check if it's a ZIP code
  if (/^\d{5}$/.test(value)) {
    return { postalCode: value };
  }

  let cityPart = "";
  let statePart = "";

  // Parse "City, ST" format (comma-separated)
  if (value.includes(",")) {
    const [city, state] = value.split(",").map(s => s.trim());
    cityPart = city;
    statePart = state;
  } else {
    // Space-separated: "Arlington Virginia" or "Arlington VA"
    const parts = value.split(" ");
    if (parts.length > 1) {
      // Last word might be state
      const lastWord = parts[parts.length - 1];
      
      // Check if last word is a 2-letter state code
      if (lastWord.length === 2) {
        statePart = lastWord;
        cityPart = parts.slice(0, -1).join(" ");
      } else {
        // Check if last word is a full state name
        const stateKey = lastWord.toLowerCase();
        if (STATE_MAP[stateKey]) {
          statePart = lastWord;
          cityPart = parts.slice(0, -1).join(" ");
        } else {
          // Try last two words as state name ("North Carolina")
          if (parts.length > 2) {
            const lastTwoWords = parts.slice(-2).join(" ").toLowerCase();
            if (STATE_MAP[lastTwoWords]) {
              statePart = parts.slice(-2).join(" ");
              cityPart = parts.slice(0, -2).join(" ");
            } else {
              // Default: treat all as city
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

  // Convert state to code
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, minPrice, maxPrice, minBeds, maxBeds, propertyType } = await req.json() as SearchParams;

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

    // Build POST body for Realty in US API v3/list with defaults
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

    // Add location to payload
    if (postalCode) {
      requestBody.postal_code = postalCode;
    } else {
      if (city) requestBody.city = city;
      if (stateCode) requestBody.state_code = stateCode;
    }

    console.log('Parsed location:', { city, stateCode, postalCode });

    // Add price filters with defaults for broad search
    requestBody.price_min = minPrice ?? 0;
    requestBody.price_max = maxPrice ?? 2000000;

    // Add beds filters
    if (minBeds) requestBody.beds_min = minBeds;
    if (maxBeds) requestBody.beds_max = maxBeds;

    // Add property type
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

    const apiUrl = 'https://realty-in-us.p.rapidapi.com/properties/v3/list';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'realty-in-us.p.rapidapi.com'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Realty API error:', response.status, errorText);
      
      let errorMessage = 'Failed to fetch listings';
      let errorDetails = '';
      
      if (response.status === 401 || response.status === 403) {
        errorMessage = 'Authentication or API key error with Realtor API.';
        errorDetails = 'Please check your RapidAPI key configuration.';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit reached for Realtor API.';
        errorDetails = 'Please try again in a few moments.';
      } else {
        errorDetails = `API returned status ${response.status}`;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: errorDetails }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Realtor API response received, data keys:', Object.keys(data));

    const properties = data?.data?.home_search?.results || data?.data?.results || data?.results || [];
    console.log('Properties count before filtering:', properties.length);

    // Normalize to HomeLens format with coordinates
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
      };
    });

    // CRITICAL: Post-filter to ensure results match the requested state
    // API sometimes returns results from wrong states with similar city names
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
