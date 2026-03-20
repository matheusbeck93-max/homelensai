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
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (!url) {
      throw new Error('URL is required');
    }

    if (!FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }

    // Validate URL is a valid HTTP(S) URL
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Please provide a valid HTTP or HTTPS URL');
      }
    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error('Please provide a valid URL');
      }
      throw e;
    }

    console.log(`Fetching property data from: ${url}`);
    
    // Use Firecrawl to scrape the URL
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 5000
      })
    });
    
    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.error('Firecrawl error:', errorText);
      throw new Error(`Firecrawl failed: ${firecrawlResponse.status}`);
    }
    
    const firecrawlData = await firecrawlResponse.json();
    console.log('Firecrawl response received');
    
    // Get the content from Firecrawl (v1 nests under data)
    const html = firecrawlData.data?.html || firecrawlData.html || '';
    const markdown = firecrawlData.data?.markdown || firecrawlData.markdown || '';
    
    if (!html && !markdown) {
      throw new Error('No content received from Firecrawl');
    }
    
    // Parse property data from HTML/markdown
    let propertyData: any = {};
    const content = html || markdown;
    
    // Extract price
    const priceMatch = content.match(/\$[\d,]+(?:,\d{3})*(?:\.\d{2})?/);
    if (priceMatch) {
      propertyData.price = parseInt(priceMatch[0].replace(/[$,]/g, ''));
    }
    
    // Extract beds/baths/sqft - improved patterns
    const bedsMatch = content.match(/(\d+)\s*(?:bed|bd|bedroom)s?\b/i);
    const bathsMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)s?\b/i);
    // Look for sqft that's NOT followed by "lot" to avoid confusion with lot size
    const sqftMatch = content.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft|square\s*feet)(?!\s*lot)/i);
    
    if (bedsMatch) propertyData.beds = parseInt(bedsMatch[1]);
    if (bathsMatch) propertyData.baths = parseFloat(bathsMatch[1]);
    if (sqftMatch) propertyData.sqft = parseInt(sqftMatch[1].replace(/,/g, ''));
    
    // Extract address
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
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
    const yearMatch = content.match(/(?:built|year built)[:\s]*(\d{4})/i);
    if (yearMatch) {
      propertyData.yearBuilt = parseInt(yearMatch[1]);
    }
    
    // Extract lot size
    const lotMatch = content.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft)\s*lot/i);
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
