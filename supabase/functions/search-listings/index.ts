import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchParams {
  location: string;
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, minPrice, maxPrice, minBeds, maxBeds, propertyType } = await req.json() as SearchParams;

    console.log('Search request:', { location, minPrice, maxPrice, minBeds, maxBeds, propertyType });

    if (!location) {
      return new Response(
        JSON.stringify({ error: 'Location is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      console.error('RAPIDAPI_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse location to extract city and state
    const locationParts = location.split(',').map(s => s.trim());
    const city = locationParts[0];
    const stateOrZip = locationParts[1] || '';

    // Build query parameters for Realty in US API
    const params = new URLSearchParams();
    
    // Location parameters
    if (city) params.append('city', city);
    if (stateOrZip) {
      // Check if it's a ZIP code (numeric) or state
      if (/^\d{5}$/.test(stateOrZip)) {
        params.append('postal_code', stateOrZip);
      } else {
        params.append('state_code', stateOrZip);
      }
    }

    // Price range
    if (minPrice) params.append('price_min', minPrice.toString());
    if (maxPrice) params.append('price_max', maxPrice.toString());

    // Beds/Baths
    if (minBeds) params.append('beds_min', minBeds.toString());
    if (maxBeds) params.append('beds_max', maxBeds.toString());

    // Property type mapping
    if (propertyType && propertyType !== 'any') {
      const typeMap: Record<string, string> = {
        'house': 'single_family',
        'condo': 'condo',
        'townhome': 'townhomes',
        'multi': 'multi_family'
      };
      params.append('prop_type', typeMap[propertyType] || 'single_family');
    }

    params.append('limit', '20');
    params.append('offset', '0');

    const apiUrl = `https://realty-in-us.p.rapidapi.com/properties/v3/list?${params.toString()}`;
    
    console.log('Calling Realty API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'realty-in-us.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Realty API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch listings', details: errorText }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Realty API response received, properties count:', data?.data?.home_search?.results?.length || 0);

    // Normalize the response to HomeLens format
    const properties = data?.data?.home_search?.results || [];
    
    const listings: HomeLensListing[] = properties.map((prop: any) => {
      const location = prop.location || {};
      const description = prop.description || {};
      const primaryPhoto = prop.primary_photo?.href || prop.photos?.[0]?.href || null;
      
      return {
        id: prop.property_id || prop.listing_id || `prop-${Math.random().toString(36).substr(2, 9)}`,
        address: `${location.address?.line || ''}, ${location.address?.city || ''}, ${location.address?.state_code || ''} ${location.address?.postal_code || ''}`.trim(),
        price: description.sold_price || description.list_price || null,
        beds: description.beds || null,
        baths: description.baths || null,
        sqft: description.sqft || null,
        photoUrl: primaryPhoto,
        listingUrl: prop.href || null,
        status: description.type || prop.status || 'for_sale',
        source: 'realty-in-us',
        city: location.address?.city || null,
        state: location.address?.state_code || null,
        zip: location.address?.postal_code || null,
      };
    });

    console.log('Returning normalized listings:', listings.length);

    return new Response(
      JSON.stringify({ listings }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in search-listings function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
