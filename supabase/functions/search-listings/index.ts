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

// TypeScript interfaces for Realtor API response
interface RealtorProperty {
  property_id?: string;
  listing_id?: string;
  address?: {
    line?: string;
    city?: string;
    state_code?: string;
    postal_code?: string;
  };
  price?: number;
  list_price?: number;
  beds?: number;
  beds_min?: number;
  baths?: number;
  baths_min?: number;
  sqft?: number;
  building_size?: {
    size?: number;
  };
  primary_photo?: {
    href?: string;
  };
  thumbnail?: string;
  photo?: string;
  rdc_web_url?: string;
  href?: string;
  status?: string;
  prop_status?: string;
}

// TODO: Implement caching for search results
// Consider using Deno KV or in-memory cache with TTL (5-10 minutes)
// Cache key: `search:${location}:${minPrice}:${maxPrice}:${minBeds}:${maxBeds}:${propertyType}`
// This would reduce RapidAPI usage and improve response times for repeated searches

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

    // Build query parameters for Realtor API
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

    // Property type mapping for Realtor API
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
    params.append('sort', 'relevance');

    const apiUrl = `https://realtor.p.rapidapi.com/api/v2/for-sale?${params.toString()}`;
    
    console.log('Calling Realtor API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'realtor.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Realty API error:', response.status, errorText);
      
      // Enhanced error handling with specific error codes
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: 'Authentication or API key error with Realtor API.',
            details: 'Please check your RapidAPI key configuration.'
          }),
          { 
            status: 502, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit reached for Realtor API.',
            details: 'Please try again in a few moments.'
          }),
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch listings', 
          details: errorText,
          statusCode: response.status
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Realtor API response received, properties count:', data?.properties?.length || 0);

    // Normalize the response to HomeLens format (Realtor API structure)
    const properties = data?.properties || [];
    
    const listings: HomeLensListing[] = properties.map((prop: any) => {
      const address = prop.address || {};
      const primaryPhoto = prop.primary_photo?.href || prop.thumbnail || prop.photo || null;
      
      console.log(`Property ${prop.property_id}: Photo URL = ${primaryPhoto}`);
      
      return {
        id: prop.property_id || prop.listing_id || `prop-${Math.random().toString(36).substr(2, 9)}`,
        address: `${address.line || ''}, ${address.city || ''}, ${address.state_code || ''} ${address.postal_code || ''}`.trim(),
        price: prop.price || prop.list_price || null,
        beds: prop.beds || prop.beds_min || null,
        baths: prop.baths || prop.baths_min || null,
        sqft: prop.sqft || prop.building_size?.size || null,
        photoUrl: primaryPhoto,
        listingUrl: prop.rdc_web_url || prop.href || null,
        status: prop.status || prop.prop_status || 'for_sale',
        source: 'realtor',
        city: address.city || undefined,
        state: address.state_code || undefined,
        zip: address.postal_code || undefined,
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
