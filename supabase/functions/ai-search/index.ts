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

    // Generate mock properties based on parsed filters
    const city = parsedFilters.city || 'Default City';
    const state = parsedFilters.state || 'FL';
    const maxPrice = parsedFilters.price_max || 1000000;
    const minBeds = parsedFilters.beds_min || 2;
    
    const mockProperties = [
      {
        id: "1",
        address: "123 Main Street",
        city: city,
        state: state,
        zip: "22201",
        price: Math.min(maxPrice * 0.7, 350000),
        beds: minBeds,
        baths: 2,
        sqft: 1800,
        image_urls: ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"],
        description: "Beautiful family home with modern updates",
        condition: "active",
        status: "active",
        externalLink: "https://www.zillow.com",
        year_built: 2010,
        lot_size: 5000,
      },
      {
        id: "2",
        address: "456 Oak Avenue",
        city: city,
        state: state,
        zip: "22202",
        price: Math.min(maxPrice * 0.85, 425000),
        beds: minBeds + 1,
        baths: 2.5,
        sqft: 2200,
        image_urls: ["https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800"],
        description: "Spacious home with pool and large backyard",
        condition: "active",
        status: "active",
        externalLink: "https://www.zillow.com",
        year_built: 2015,
        lot_size: 7500,
      },
      {
        id: "3",
        address: "789 Pine Road",
        city: city,
        state: state,
        zip: "22203",
        price: Math.min(maxPrice * 0.6, 285000),
        beds: minBeds,
        baths: 2,
        sqft: 1400,
        image_urls: ["https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800"],
        description: "Cozy starter home, move-in ready",
        condition: "active",
        status: "active",
        externalLink: "https://www.zillow.com",
        year_built: 2008,
        lot_size: 4000,
      },
      {
        id: "4",
        address: "321 Elm Street",
        city: city,
        state: state,
        zip: "22204",
        price: Math.min(maxPrice * 0.95, 550000),
        beds: minBeds + 2,
        baths: 3,
        sqft: 3000,
        image_urls: ["https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800"],
        description: "Luxury home with high-end finishes",
        condition: "active",
        status: "active",
        externalLink: "https://www.zillow.com",
        year_built: 2020,
        lot_size: 8000,
      },
      {
        id: "5",
        address: "567 Maple Drive",
        city: city,
        state: state,
        zip: "22205",
        price: Math.min(maxPrice * 0.5, 195000),
        beds: minBeds,
        baths: 1,
        sqft: 1100,
        image_urls: ["https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800"],
        description: "Investment opportunity, needs updates",
        condition: "active",
        status: "active",
        externalLink: "https://www.zillow.com",
        year_built: 2005,
        lot_size: 3500,
      },
      {
        id: "6",
        address: "890 Cedar Lane",
        city: city,
        state: state,
        zip: "22206",
        price: Math.min(maxPrice * 0.75, 395000),
        beds: minBeds + 1,
        baths: 2.5,
        sqft: 2100,
        image_urls: ["https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800"],
        description: "Modern townhouse in great neighborhood",
        condition: "active",
        status: "active",
        externalLink: "https://www.zillow.com",
        year_built: 2018,
        lot_size: 2500,
      },
      {
        id: "7",
        address: "234 Birch Court",
        city: city,
        state: state,
        zip: "22207",
        price: Math.min(maxPrice * 0.65, 315000),
        beds: minBeds,
        baths: 2,
        sqft: 1650,
        image_urls: ["https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800"],
        description: "Charming single-family home",
        condition: "active",
        status: "active",
        externalLink: "https://www.zillow.com",
        year_built: 2012,
        lot_size: 5500,
      },
      {
        id: "8",
        address: "678 Willow Way",
        city: city,
        state: state,
        zip: "22208",
        price: Math.min(maxPrice * 0.9, 475000),
        beds: minBeds + 1,
        baths: 3,
        sqft: 2500,
        image_urls: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"],
        description: "Updated home with open floor plan",
        condition: "active",
        status: "active",
        externalLink: "https://www.zillow.com",
        year_built: 2016,
        lot_size: 6500,
      }
    ];

    // Filter properties based on criteria
    const properties = mockProperties.filter(prop => {
      if (parsedFilters.price_max && prop.price > parsedFilters.price_max) return false;
      if (parsedFilters.price_min && prop.price < parsedFilters.price_min) return false;
      if (parsedFilters.beds_min && prop.beds < parsedFilters.beds_min) return false;
      if (parsedFilters.baths_min && prop.baths < parsedFilters.baths_min) return false;
      return true;
    });

    console.log(`Generated ${properties.length} mock properties`);

    if (properties.length === 0) {
      console.log('No properties match the criteria');
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
