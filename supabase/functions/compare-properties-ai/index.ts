import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { properties } = await req.json();

    if (!properties || properties.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 properties required for comparison' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile to determine buyer type
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    let buyerType = 'primary_residence'; // default
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('buyer_type')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profile?.buyer_type) {
        buyerType = profile.buyer_type;
      }
    }

    // Format properties for AI analysis
    const propertyDescriptions = properties.map((p: any, idx: number) => {
      const metrics = p.insights?.rentcast ? `
- Estimated Rent: $${p.insights.rentcast.rent_estimate?.toLocaleString() || 'N/A'}/month
- Estimated Value: $${p.insights.rentcast.value_estimate?.toLocaleString() || 'N/A'}
- Rent-to-Price Ratio: ${p.insights.rentcast.rent_to_price_ratio?.toFixed(3) || 'N/A'}` : '';

      const demographics = p.insights?.census ? `
- Median Household Income: $${p.insights.census.median_household_income?.toLocaleString() || 'N/A'}
- Owner-Occupied Rate: ${p.insights.census.owner_occupied_rate ? (p.insights.census.owner_occupied_rate * 100).toFixed(1) + '%' : 'N/A'}` : '';

      return `
**Property ${idx + 1}: ${p.address}, ${p.city}, ${p.state}**
- List Price: $${p.price?.toLocaleString() || 'N/A'}
- Bedrooms: ${p.beds || 'N/A'}
- Bathrooms: ${p.baths || 'N/A'}
- Square Feet: ${p.sqft?.toLocaleString() || 'N/A'}
- Price per Sqft: $${p.price && p.sqft ? (p.price / p.sqft).toFixed(0) : 'N/A'}
- Property Type: ${p.propertyType || 'N/A'}
- Year Built: ${p.yearBuilt || 'N/A'}${metrics}${demographics}`;
    }).join('\n\n');

    const buyerGoal = buyerType === 'investor' 
      ? 'rental investment property with strong cash flow and appreciation potential'
      : 'primary residence that offers good value, livability, and long-term appreciation';

    const systemPrompt = `You are a real estate expert analyzing properties for a ${buyerType === 'investor' ? 'real estate investor' : 'home buyer looking for a primary residence'}. 

Your goal is to provide a clear, data-driven recommendation on which property offers the best value based on their goal: ${buyerGoal}.

For investors, prioritize:
- Cash-on-cash return
- Rent-to-price ratio
- Market appreciation potential
- Cashflow (positive is critical)
- Area demographics (income, owner-occupied rate)

For primary residence buyers, prioritize:
- Price per square foot value
- Livability factors (beds, baths, sqft)
- Neighborhood quality indicators
- Long-term appreciation potential
- Overall affordability

Provide a structured analysis:
1. Quick Summary (2-3 sentences on best choice)
2. Property-by-Property Breakdown (key pros/cons for each)
3. Final Recommendation (which property and why)

Be specific with numbers, direct, and actionable. Keep it under 500 words.`;

    const userPrompt = `Compare these ${properties.length} properties and recommend the best one:\n\n${propertyDescriptions}`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content;

    if (!analysis) {
      throw new Error('No analysis generated');
    }

    return new Response(
      JSON.stringify({ analysis, buyerType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compare-properties-ai:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
