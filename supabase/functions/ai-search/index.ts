const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, categories } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    if (!RAPIDAPI_KEY) {
      throw new Error('RAPIDAPI_KEY is not configured');
    }

    // Parse natural language query with AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a property search query parser for US real estate. Convert natural language searches into structured filters.
${categories && categories.length > 0 ? `\nUser context: ${categories.join(', ')}. Tailor the search based on:
- first-time-buyer: Focus on move-in ready homes, FHA-eligible, lower price ranges, good school districts
- mortgage-calculator: Prioritize properties with good financing potential, standard loans
- pre-approval: Include pre-approval friendly properties, competitive rates, VA/FHA eligible` : ''}

Return JSON with: price_min, price_max, beds_min, baths_min, city, state, property_type.
If no city is mentioned, use "Miami". If no state is mentioned, use "FL".
Example: "3-bedroom homes under $650k in Arlington VA" -> 
{"price_max": 650000, "beds_min": 3, "city": "Arlington", "state": "VA", "property_type": "single_family"}`
          },
          {
            role: 'user',
            content: query
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsedFilters = JSON.parse(content);
    
    console.log('Parsed filters:', parsedFilters);

    // Call RealtyMole API to get real property listings
    const rapidApiUrl = new URL('https://realtymole-rental-estimate-v1.p.rapidapi.com/properties');
    
    // Build query parameters
    if (parsedFilters.city) {
      rapidApiUrl.searchParams.append('city', parsedFilters.city);
    }
    if (parsedFilters.state) {
      rapidApiUrl.searchParams.append('state', parsedFilters.state);
    }
    if (parsedFilters.beds_min) {
      rapidApiUrl.searchParams.append('bedrooms', parsedFilters.beds_min.toString());
    }
    if (parsedFilters.price_max) {
      rapidApiUrl.searchParams.append('maxPrice', parsedFilters.price_max.toString());
    }
    if (parsedFilters.price_min) {
      rapidApiUrl.searchParams.append('minPrice', parsedFilters.price_min.toString());
    }
    
    rapidApiUrl.searchParams.append('limit', '20');

    console.log('Calling RealtyMole API:', rapidApiUrl.toString());

    const realtyResponse = await fetch(rapidApiUrl.toString(), {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'realtymole-rental-estimate-v1.p.rapidapi.com'
      }
    });

    if (!realtyResponse.ok) {
      const errorText = await realtyResponse.text();
      console.error('RealtyMole API error:', realtyResponse.status, errorText);
      throw new Error(`RealtyMole API error: ${realtyResponse.status}`);
    }

    const realtyData = await realtyResponse.json();
    console.log('RealtyMole API response:', JSON.stringify(realtyData).substring(0, 500));

    // Transform RealtyMole data to our property format
    const properties = (realtyData.listings || realtyData || []).slice(0, 20).map((listing: any) => ({
      id: listing.id || listing.zpid || Math.random().toString(),
      address: listing.address || listing.streetAddress || 'Address not available',
      city: listing.city || parsedFilters.city || 'Unknown',
      state: listing.state || parsedFilters.state || 'Unknown',
      zip: listing.zipcode || listing.zip || '',
      price: listing.price || listing.listPrice || 0,
      beds: listing.bedrooms || listing.beds || 0,
      baths: listing.bathrooms || listing.baths || 0,
      sqft: listing.livingArea || listing.sqft || 0,
      image_urls: listing.photos || listing.imgSrc ? [listing.photos?.[0] || listing.imgSrc] : ['https://images.unsplash.com/photo-1568605114967-8130f3a36994'],
      description: listing.description || '',
      condition: 'active',
      status: 'active',
      externalLink: listing.url || listing.detailUrl || `https://www.zillow.com/homes/${encodeURIComponent(listing.address || '')}_rb/`,
      year_built: listing.yearBuilt || null,
      lot_size: listing.lotSize || null,
    }));

    console.log(`Transformed ${properties.length} properties from RealtyMole`);

    return new Response(
      JSON.stringify({ properties, filters: parsedFilters }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-search:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
