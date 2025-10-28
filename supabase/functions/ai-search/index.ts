const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to generate realistic property data
function generateRealisticProperties(filters: any, count: number = 10) {
  const properties = [];
  const city = filters.city || 'Miami';
  const state = filters.state || 'FL';
  
  // Real streets in common US cities
  const streets = [
    'Main Street', 'Oak Avenue', 'Maple Drive', 'Washington Boulevard',
    'Park Lane', 'Cedar Court', 'Pine Street', 'Elm Avenue', 'River Road',
    'Lake Drive', 'Forest Avenue', 'Hill Street', 'Valley Road', 'Sunset Boulevard'
  ];
  
  const propertyTypes = ['Single Family', 'Townhouse', 'Condo', 'Multi-Family'];
  
  for (let i = 0; i < count; i++) {
    const basePrice = filters.price_min || 200000;
    const maxPrice = filters.price_max || 1000000;
    const price = Math.floor(Math.random() * (maxPrice - basePrice) + basePrice);
    const beds = filters.beds_min || Math.floor(Math.random() * 3) + 2;
    const baths = Math.floor(Math.random() * 2) + 1.5;
    const sqft = Math.floor(Math.random() * 1500) + 1200;
    const streetNumber = Math.floor(Math.random() * 9000) + 1000;
    const street = streets[Math.floor(Math.random() * streets.length)];
    const address = `${streetNumber} ${street}`;
    const zip = `${Math.floor(Math.random() * 90000) + 10000}`;
    
    // Generate Zillow search link
    const zillowQuery = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`);
    const zillowLink = `https://www.zillow.com/homes/${zillowQuery}_rb/`;
    
    // Use relevant real estate images from Unsplash
    const imageCategories = [
      'photo-1568605114967-8130f3a36994', // house exterior
      'photo-1564013799919-ab600027ffc6', // modern house
      'photo-1600585154340-be6161a56a0c', // house front
      'photo-1600596542815-ffad4c1539a9', // suburban house
      'photo-1600607687939-ce8a6c25118c', // luxury home
      'photo-1600607687644-aac4c3eac7f4', // traditional house
      'photo-1605146769289-440113cc3d00', // contemporary home
      'photo-1600566753190-17f0baa2a6c3', // residential property
    ];
    
    const imageId = imageCategories[i % imageCategories.length];
    
    properties.push({
      id: `prop-${Date.now()}-${i}`,
      address,
      city,
      state,
      zip,
      price,
      beds,
      baths,
      sqft,
      image_urls: [`https://images.unsplash.com/${imageId}?w=800&h=600&fit=crop`],
      description: `Beautiful ${beds} bedroom, ${baths} bath ${propertyTypes[i % propertyTypes.length].toLowerCase()} in ${city}. This property features ${sqft} sq ft of living space.`,
      condition: 'active',
      status: 'active',
      externalLink: zillowLink,
      year_built: Math.floor(Math.random() * 30) + 1990,
      lot_size: Math.floor(Math.random() * 8000) + 2000,
      property_type: propertyTypes[i % propertyTypes.length]
    });
  }
  
  return properties;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, categories } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

Return ONLY valid JSON (no markdown) with: price_min, price_max, beds_min, baths_min, city, state, property_type.
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

    // Generate realistic property listings based on search criteria
    const properties = generateRealisticProperties(parsedFilters, 12);

    console.log(`Generated ${properties.length} realistic property listings`);

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
