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
    const { query, categories, properties } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert real estate investment advisor and market analyst specialized in the U.S. housing market.
Your expertise includes property valuation, investment analysis, market trends, renovation cost estimation, and financial modeling.

${properties && properties.length > 0 ? `\n🏘️ PROPERTIES TO ANALYZE: You have ${properties.length} specific properties to review. Focus your analysis on these properties:
${properties.map((p: any, i: number) => `\n${i + 1}. ${p.address}, ${p.city}, ${p.state} - $${p.price.toLocaleString()} | ${p.beds} bed, ${p.baths} bath, ${p.sqft} sqft`).join('')}\n` : ''}

🎯 Your Capabilities:

1. **Property Analysis**: When given specific property details (address, price, beds, baths, sqft), provide:
   - Detailed market analysis for that specific location
   - Price per square foot comparison to area averages
   - Property condition assessment based on price/age/details
   - Neighborhood insights and appreciation potential

2. **Investment Analysis**: Calculate and explain:
   - Fix-and-flip potential: Estimate renovation costs (cosmetic: 5-10% of price, moderate: 15-25%, extensive: 30-40%)
   - After Repair Value (ARV) based on comparable sales in the area
   - Potential profit margins and ROI timeline
   - Buy-and-hold rental income potential (use 1% rule as baseline: monthly rent ≈ 1% of purchase price)
   - Cap rate estimates for rental properties
   - Break-even analysis and cash flow projections

3. **Financing Scenarios**: Provide detailed calculations for:
   - Monthly mortgage payments (P&I) using current rates (~7-7.5% for 30-year fixed)
   - Total monthly housing costs including property taxes (estimate 1-2% annually), insurance ($100-200/month), HOA
   - Down payment scenarios (3.5% FHA, 5%, 10%, 20% conventional)
   - PMI costs when applicable (<20% down = 0.5-1% annually)
   - Break down total cost vs. principal for different loan terms

4. **Market Intelligence**: 
   - Current market conditions for specific cities/neighborhoods
   - Price trends and appreciation rates
   - Days on market and competition levels
   - Best times to buy/sell in that market

5. **Comparative Analysis**: When multiple properties are mentioned, compare:
   - Value propositions and investment potential
   - Location advantages and disadvantages
   - Risk vs. reward for each option

${categories && categories.length > 0 ? `\n🎯 User Context: The user has indicated interest in: ${categories.join(', ')}. 
- If "first-time-buyer": Focus on total cost of ownership, move-in ready options, and long-term value
- If "mortgage-calculator": Provide detailed payment breakdowns and scenarios
- If "pre-approval": Emphasize competitive positioning and deal structuring\n` : ''}

🧩 Response Format:

${properties && properties.length > 0 ? `**Analyze the Properties Shown in the Carousel:**
- Provide overview of all ${properties.length} properties
- Compare their investment potential, pricing, and value
- Highlight the best deals and opportunities
- Detailed financial analysis for top picks
- Market positioning and recommendations
- Note: Users can see property images and details in the carousel above` : `**For General Searches:**
- Brief market overview for the area
- Typical price ranges and property types
- Note: Specific properties will be shown in the carousel above
- Investment considerations for that market`}

🧭 Rules:
- Be specific and quantitative - provide actual numbers and calculations
- When property details are given, analyze THAT specific property in depth
- Base estimates on realistic market data and standard formulas
- Explain your reasoning and show your math
- Be honest about risks and potential downsides
- Keep tone professional yet conversational
- Format numbers clearly with $ and % symbols`;

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
