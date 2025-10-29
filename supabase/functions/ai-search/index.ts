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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    if (!RAPIDAPI_KEY) {
      throw new Error('RAPIDAPI_KEY is not configured. Please add your RapidAPI key.');
    }

    // Debug: Log first 10 characters of API key to verify it's updated
    console.log('Using RAPIDAPI_KEY starting with:', RAPIDAPI_KEY?.substring(0, 10));

    // Parse natural language query with AI
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
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

    // Fetch from Redfin API
    try {
      // Step 1: Get location/region ID from auto-complete
      const searchLocation = parsedFilters.city && parsedFilters.state 
        ? `${parsedFilters.city}, ${parsedFilters.state}` 
        : parsedFilters.city || parsedFilters.state || 'Miami, FL';

      console.log('Searching Redfin for location:', searchLocation);

      const autocompleteUrl = `https://redfin-com-data.p.rapidapi.com/properties/auto-complete?query=${encodeURIComponent(searchLocation)}`;
      
      const autocompleteResponse = await fetch(autocompleteUrl, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'redfin-com-data.p.rapidapi.com'
        }
      });

      if (!autocompleteResponse.ok) {
        const errorText = await autocompleteResponse.text();
        console.error('Redfin autocomplete error:', autocompleteResponse.status, errorText);
        throw new Error(`Redfin autocomplete failed: ${errorText}`);
      }

      const autocompleteData = await autocompleteResponse.json();
      console.log('Redfin autocomplete response:', JSON.stringify(autocompleteData).substring(0, 500));

      // Find the best matching region (city or county)
      let regionId = null;
      if (autocompleteData.data && autocompleteData.data.length > 0) {
        // Look for Places section first
        const placesSection = autocompleteData.data.find((section: any) => section.name === 'Places');
        if (placesSection && placesSection.rows && placesSection.rows.length > 0) {
          // Prefer city (type 2) over other types
          const cityMatch = placesSection.rows.find((row: any) => row.type === '2');
          regionId = cityMatch ? cityMatch.id : placesSection.rows[0].id;
        }
      }

      if (!regionId) {
        throw new Error('Could not find region ID for location');
      }

      console.log('Found region ID:', regionId);

      // Step 2: Search for properties using region ID
      const searchUrl = new URL('https://redfin-com-data.p.rapidapi.com/properties/search-sale');
      searchUrl.searchParams.append('regionId', regionId);
      
      if (parsedFilters.beds_min) {
        searchUrl.searchParams.append('minBeds', parsedFilters.beds_min.toString());
      }
      if (parsedFilters.baths_min) {
        searchUrl.searchParams.append('minBaths', parsedFilters.baths_min.toString());
      }
      if (parsedFilters.price_min) {
        searchUrl.searchParams.append('minPrice', parsedFilters.price_min.toString());
      }
      if (parsedFilters.price_max) {
        searchUrl.searchParams.append('maxPrice', parsedFilters.price_max.toString());
      }

      console.log('Redfin search URL:', searchUrl.toString());

      const searchResponse = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'redfin-com-data.p.rapidapi.com'
        }
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('Redfin search error:', searchResponse.status, errorText);
        throw new Error(`Redfin search failed: ${errorText}`);
      }

      const searchData = await searchResponse.json();
      console.log('Redfin search response status:', searchResponse.status);
      console.log('Redfin search response preview:', JSON.stringify(searchData).substring(0, 1000));

      // Transform Redfin data to our format
      if (searchData.data && searchData.data.homes && Array.isArray(searchData.data.homes)) {
        properties = searchData.data.homes.slice(0, 12).map((home: any) => {
          const priceInfo = home.priceInfo || {};
          const addressInfo = home.addressInfo || {};
          
          return {
            id: home.propertyId?.toString() || home.listingId?.toString() || Math.random().toString(),
            address: addressInfo.formattedStreetLine || addressInfo.streetAddress || 'Address not available',
            city: addressInfo.city || parsedFilters.city || 'Unknown',
            state: addressInfo.state || parsedFilters.state || 'Unknown',
            zip: addressInfo.zip || '',
            price: priceInfo.amount || home.price || 0,
            beds: home.beds || home.numBeds || 0,
            baths: home.baths || home.numBaths || 0,
            sqft: home.sqFt || home.squareFeet || 0,
            image_urls: home.photos ? [home.photos] : (home.photoUrls || ['https://images.unsplash.com/photo-1568605114967-8130f3a36994']),
            description: home.listingRemarks || `${home.beds || 0} bed, ${home.baths || 0} bath ${home.propertyType || 'property'}`,
            condition: 'active',
            status: 'active',
            externalLink: home.url ? `https://www.redfin.com${home.url}` : null,
            year_built: home.yearBuilt || null,
            lot_size: home.lotSize || null,
          };
        });
        console.log(`Successfully fetched ${properties.length} properties from Redfin`);
      }
    } catch (redfinError) {
      console.error('Error fetching from Redfin:', redfinError);
      throw redfinError;
    }

    // Return properties only if we got real data from Redfin
    if (properties.length === 0) {
      console.log('No properties found from Redfin API');
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
