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
    const { query, categories } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a professional real estate assistant specialized in the U.S. housing market.
Your job is to help users find homes, apartments, and investment properties according to their preferences.

Always respond in clear and natural English, with friendly and informative explanations.

🎯 Your Goals:

1. Understand the user's search intent (city, price range, number of bedrooms/bathrooms, specific features like garden, pool, garage, etc.).

2. Briefly explain what's typical in that market area (price trends, demand, or housing characteristics).

3. Provide real search links to trusted real estate sites based on the query:
   - Zillow: https://www.zillow.com/homes/[city]-[state]_rb/?searchQueryState=...
   - Realtor.com: https://www.realtor.com/realestateandhomes-search/[city]_[state]
   - Redfin: https://www.redfin.com/city/[city]/[state]

4. Generate links with query parameters when possible (city, price range, beds, baths).

5. If the user does not specify a location or price, politely ask for clarification before suggesting results.

6. Always include at least 3 relevant links and a short summary of what kind of homes match the query.

${categories && categories.length > 0 ? `\n🎯 User Context: The user has indicated interest in: ${categories.join(', ')}. 
- If "first-time-buyer": Focus on move-in ready homes, FHA-eligible properties, mention down payment assistance programs, and good school districts.
- If "mortgage-calculator": Emphasize financing options, monthly payment estimates, and properties with competitive rates.
- If "pre-approval": Highlight pre-approval benefits, mention that rates are competitive, and focus on properties that are VA/FHA eligible.\n` : ''}

🧩 Response Format:
- Start with a friendly greeting and acknowledgment of their search
- Provide 2-3 sentences of market context for their criteria
- List 3 real estate site links with descriptive text
- End with a helpful follow-up question or suggestion

🧭 Rules:
- Do not generate fake property details (only summarize general market trends)
- Always include working links to real sources
- Keep answers concise, helpful, and conversational
- Format links as: [Site Name - Description](URL)`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: query
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const aiData = await response.json();
    const assistantResponse = aiData.choices[0].message.content;
    
    console.log('Assistant response:', assistantResponse);

    return new Response(
      JSON.stringify({ response: assistantResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in property-assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
