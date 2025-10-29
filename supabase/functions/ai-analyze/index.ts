// Edge function for AI property analysis

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { property } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const prompt = `Analyze this property investment opportunity and provide a detailed report in plain English:

Property Details:
- Address: ${property.address}, ${property.city}, ${property.state}
- Purchase Price: $${property.price}
- Bedrooms: ${property.beds} | Bathrooms: ${property.baths}
- Square Footage: ${property.sqft} sqft
- Condition: ${property.condition}
- Year Built: ${property.year_built}
${property.arv ? `- After Repair Value (ARV): $${property.arv}` : ''}
${property.rehab_cost ? `- Estimated Rehab Cost: $${property.rehab_cost}` : ''}
${property.roi_percent ? `- Estimated ROI: ${property.roi_percent}%` : ''}

Provide a comprehensive analysis including:
1. Investment Potential (rating out of 10)
2. Key Strengths
3. Potential Concerns
4. Recommended Strategy (flip, hold, pass)
5. Plain English Summary for someone new to real estate investing`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are an experienced real estate investment analyst. Provide clear, actionable advice.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-analyze:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
