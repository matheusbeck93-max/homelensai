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
    const ZILLOW_API_KEY = Deno.env.get('ZILLOW_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    if (!ZILLOW_API_KEY) {
      throw new Error('ZILLOW_API_KEY is not configured. Please add your Zillow API key.');
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

Return ONLY valid JSON (no markdown) with: price_min, price_max, beds_min, baths_min, city, state.
Example: "3-bedroom homes under $650k in Arlington VA" -> 
{"price_max": 650000, "beds_min": 3, "city": "Arlington", "state": "VA"}`
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

    let properties = [];

    // Try to fetch from Zillow API if key is available
    if (ZILLOW_API_KEY) {
      try {
        // Build search location string
        const location = parsedFilters.city && parsedFilters.state 
          ? `${parsedFilters.city}, ${parsedFilters.state}` 
          : parsedFilters.city || parsedFilters.state || 'Miami, FL';

        console.log('Searching Zillow for location:', location);

        // Try propertyExtendedSearch endpoint
        const zillowUrl = 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch';
        const params = new URLSearchParams({
          location: location,
          status_type: 'ForSale',
        });

        if (parsedFilters.beds_min) {
          params.append('bedsMin', parsedFilters.beds_min.toString());
        }
        if (parsedFilters.baths_min) {
          params.append('bathsMin', parsedFilters.baths_min.toString());
        }
        if (parsedFilters.price_min) {
          params.append('priceMin', parsedFilters.price_min.toString());
        }
        if (parsedFilters.price_max) {
          params.append('priceMax', parsedFilters.price_max.toString());
        }

        console.log('Zillow API URL:', `${zillowUrl}?${params.toString()}`);

        const zillowResponse = await fetch(`${zillowUrl}?${params.toString()}`, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': ZILLOW_API_KEY,
            'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
          }
        });

        if (zillowResponse.ok) {
          const zillowData = await zillowResponse.json();
          console.log('Zillow API response status:', zillowResponse.status);
          console.log('Zillow API response preview:', JSON.stringify(zillowData).substring(0, 500));

          // Transform Zillow data
          if (zillowData.props && Array.isArray(zillowData.props)) {
            properties = zillowData.props.slice(0, 12).map((prop: any) => ({
              id: prop.zpid || prop.id || Math.random().toString(),
              address: prop.address || prop.streetAddress || 'Address not available',
              city: prop.city || parsedFilters.city || 'Unknown',
              state: prop.state || parsedFilters.state || 'Unknown',
              zip: prop.zipcode || prop.zip || '',
              price: prop.price || prop.listPrice || 0,
              beds: prop.bedrooms || prop.beds || 0,
              baths: prop.bathrooms || prop.baths || 0,
              sqft: prop.livingArea || prop.sqft || prop.area || 0,
              image_urls: prop.imgSrc ? [prop.imgSrc] : prop.photos || ['https://images.unsplash.com/photo-1568605114967-8130f3a36994'],
              description: prop.description || `${prop.bedrooms || 0} bed, ${prop.bathrooms || 0} bath property`,
              condition: 'active',
              status: 'active',
              externalLink: prop.detailUrl || `https://www.zillow.com/homedetails/${prop.zpid}_zpid/`,
              year_built: prop.yearBuilt || null,
              lot_size: prop.lotSize || null,
            }));
            console.log(`Successfully fetched ${properties.length} properties from Zillow`);
          }
        } else {
          const errorText = await zillowResponse.text();
          console.error('Zillow API error:', zillowResponse.status, errorText);
        }
      } catch (zillowError) {
        console.error('Error fetching from Zillow:', zillowError);
      }
    }

    // Return properties only if we got real data from Zillow
    if (properties.length === 0) {
      console.log('No properties found from Zillow API');
      return new Response(
        JSON.stringify({ 
          properties: [], 
          filters: parsedFilters,
          message: 'No properties found matching your criteria. Please try adjusting your search parameters.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
