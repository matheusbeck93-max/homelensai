import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchParams {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  propertyType?: 'house' | 'condo' | 'townhome' | 'multi' | 'any';
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
  city?: string;
  state?: string;
  zip?: string;
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

    // Build POST body for Realty in US API v3/list
    const requestBody: any = {
      limit: 20,
      offset: 0,
      status: ["for_sale", "ready_to_build"],
      sort: {
        direction: "desc",
        field: "list_date"
      }
    };

    // Determine location - use provided location or default to Miami, FL
    const DEFAULT_AREA = "Miami, FL";
    const searchLocation = location || DEFAULT_AREA;
    
    const isZip = /^\d{5}$/.test(searchLocation.trim());
    
    if (isZip) {
      requestBody.postal_code = searchLocation.trim();
    } else {
      const parts = searchLocation.split(',').map(s => s.trim());
      const city = parts[0] || '';
      const stateCode = parts[1] || '';
      
      if (city) requestBody.city = city;
      if (stateCode) requestBody.state_code = stateCode;
    }

    // Add price filters
    if (minPrice) requestBody.price_min = minPrice;
    if (maxPrice) requestBody.price_max = maxPrice;

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
    console.log('Properties count:', properties.length);

    // Normalize to HomeLens format
    const listings: HomeLensListing[] = properties.map((prop: any) => {
      const location = prop.location || {};
      const address = location.address || {};
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
        city: address.city || undefined,
        state: address.state_code || undefined,
        zip: address.postal_code || undefined,
      };
    });

    console.log('Returning normalized listings:', listings.length);

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
