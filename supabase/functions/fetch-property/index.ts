import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      throw new Error('URL is required');
    }

    // Validate URL is from supported sites
    const urlPattern = /(zillow|realtor|redfin|trulia|homes)\.com/i;
    if (!urlPattern.test(url)) {
      throw new Error('Please use a URL from Zillow, Realtor, Redfin, Trulia, or Homes.com');
    }

    console.log(`Fetching property data from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse property data from HTML
    let propertyData: any = {};
    
    // Extract price
    const priceMatch = html.match(/\$[\d,]+(?:,\d{3})*(?:\.\d{2})?/);
    if (priceMatch) {
      propertyData.price = parseInt(priceMatch[0].replace(/[$,]/g, ''));
    }
    
    // Extract beds/baths/sqft
    const bedsMatch = html.match(/(\d+)\s*(?:bed|bd|bedroom)/i);
    const bathsMatch = html.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)/i);
    const sqftMatch = html.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)/i);
    
    if (bedsMatch) propertyData.beds = parseInt(bedsMatch[1]);
    if (bathsMatch) propertyData.baths = parseFloat(bathsMatch[1]);
    if (sqftMatch) propertyData.sqft = parseInt(sqftMatch[1].replace(/,/g, ''));
    
    // Extract address
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      const fullAddress = h1Match[1].trim();
      propertyData.address = fullAddress;
      
      // Try to extract city, state, zip
      const locationMatch = fullAddress.match(/,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/);
      if (locationMatch) {
        propertyData.city = locationMatch[1].trim();
        propertyData.state = locationMatch[2];
        propertyData.zip = locationMatch[3] || '';
      }
    }
    
    // Extract year built
    const yearMatch = html.match(/(?:built|year built)[:\s]*(\d{4})/i);
    if (yearMatch) {
      propertyData.yearBuilt = parseInt(yearMatch[1]);
    }
    
    // Extract lot size
    const lotMatch = html.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft)\s*lot/i);
    if (lotMatch) {
      propertyData.lotSize = parseInt(lotMatch[1].replace(/,/g, ''));
    }
    
    console.log('Extracted property data:', propertyData);
    
    // Set defaults for missing data
    propertyData.address = propertyData.address || 'Property Address';
    propertyData.city = propertyData.city || 'City';
    propertyData.state = propertyData.state || 'ST';
    propertyData.zip = propertyData.zip || '00000';
    propertyData.price = propertyData.price || 0;
    propertyData.beds = propertyData.beds || 3;
    propertyData.baths = propertyData.baths || 2;
    propertyData.sqft = propertyData.sqft || 1500;
    propertyData.yearBuilt = propertyData.yearBuilt || 2000;
    propertyData.lotSize = propertyData.lotSize || 5000;

    return new Response(
      JSON.stringify({ propertyData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-property:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
