import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
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
            content: `You are a property search query parser. Convert natural language searches into structured filters.
Return JSON with: price_min, price_max, beds_min, baths_min, city, condition, roi_min.
Example: "3-bedroom fixers under $650k in Arlington with ROI over 15%" -> 
{"price_max": 650000, "beds_min": 3, "city": "Arlington", "condition": "fixer", "roi_min": 15}`
          },
          {
            role: 'user',
            content: query
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const parsedFilters = JSON.parse(aiData.choices[0].message.content);
    
    console.log('Parsed filters:', parsedFilters);

    // Query Supabase with parsed filters
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let dbQuery = supabase
      .from('properties')
      .select('*')
      .eq('status', 'active');

    if (parsedFilters.price_min) {
      dbQuery = dbQuery.gte('price', parsedFilters.price_min);
    }
    if (parsedFilters.price_max) {
      dbQuery = dbQuery.lte('price', parsedFilters.price_max);
    }
    if (parsedFilters.beds_min) {
      dbQuery = dbQuery.gte('beds', parsedFilters.beds_min);
    }
    if (parsedFilters.baths_min) {
      dbQuery = dbQuery.gte('baths', parsedFilters.baths_min);
    }
    if (parsedFilters.city) {
      dbQuery = dbQuery.ilike('city', `%${parsedFilters.city}%`);
    }
    if (parsedFilters.condition) {
      dbQuery = dbQuery.eq('condition', parsedFilters.condition);
    }
    if (parsedFilters.roi_min) {
      dbQuery = dbQuery.gte('roi_percent', parsedFilters.roi_min);
    }

    const { data: properties, error } = await dbQuery.order('created_at', { ascending: false });

    if (error) {
      throw error;
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
