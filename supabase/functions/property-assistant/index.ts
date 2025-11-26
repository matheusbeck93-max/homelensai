import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const assistantRequestSchema = z.object({
  query: z.string().min(1).max(5000),
  categories: z.array(z.string()).optional(),
  properties: z.array(z.any()).optional(),
  marketSnapshot: z.any().optional(),
});

// Detect if query is a property search
function isPropertySearch(text: string): boolean {
  const keywords = /(find|search|looking for|looking to buy|for sale|house|apartment|bedroom|beds|bath|realtor|zillow|redfin|home|property|condo|townhouse)/i;
  const pricePattern = /\$?\s?\d{1,3}(?:[,.]\d{3})*(?:\s?M|\s?k)?/i;
  const locationPattern = /(in|near|around|at)\s+[A-Z][a-z]+/i;
  return keywords.test(text) || (pricePattern.test(text) && locationPattern.test(text));
}

// Extract search parameters from query
function extractSearchParams(query: string) {
  const bedsMatch = query.match(/(\d+)\s*(bed|bedroom)/i);
  const beds = bedsMatch ? parseInt(bedsMatch[1]) : undefined;
  
  const priceMatch = query.match(/\$?\s?(\d+(?:[,.]\d{3})*)\s?(M|k)?/i);
  let maxPrice = undefined;
  if (priceMatch) {
    const num = parseInt(priceMatch[1].replace(/[,.]/g, ''));
    if (priceMatch[2]?.toLowerCase() === 'm') maxPrice = num * 1000000;
    else if (priceMatch[2]?.toLowerCase() === 'k') maxPrice = num * 1000;
    else maxPrice = num;
  }
  
  const locationMatch = query.match(/(?:in|near|around|at)\s+([A-Za-z\s]+?)(?:\s|,|$)/i);
  const location = locationMatch ? locationMatch[1].trim() : '';
  
  return { beds, maxPrice, location };
}

// Build real property search URLs
function buildPropertyLinks(query: string) {
  const { beds, maxPrice, location } = extractSearchParams(query);
  const links = [];
  
  // Zillow
  const zillowLocation = location.replace(/\s+/g, '-').replace(',', '');
  let zillowUrl = `https://www.zillow.com/homes/${zillowLocation}_rb/`;
  if (beds || maxPrice) {
    const params: string[] = [];
    if (beds) params.push(`${beds}_beds`);
    if (maxPrice) params.push(`0-${maxPrice}_price`);
    zillowUrl += `?searchQueryState={"pagination":{},"mapBounds":{},"filterState":{${params.map(p => {
      if (p.includes('beds')) return `"beds":{"min":${beds}}`;
      if (p.includes('price')) return `"price":{"max":${maxPrice}}`;
      return '';
    }).filter(Boolean).join(',')}}}`;
  }
  links.push({
    source: 'Zillow',
    url: zillowUrl,
    title: `${beds ? beds + ' bedroom' : ''} ${location ? 'house in ' + location : 'properties'}${maxPrice ? ' up to $' + (maxPrice/1000000 >= 1 ? (maxPrice/1000000)+'M' : (maxPrice/1000)+'k') : ''}`
  });
  
  // Realtor.com
  const realtorLocation = location.replace(/\s+/g, '_').replace(',', '');
  let realtorUrl = `https://www.realtor.com/realestateandhomes-search/${realtorLocation}`;
  const realtorParams: string[] = [];
  if (beds) realtorParams.push(`beds-${beds}`);
  if (maxPrice) realtorParams.push(`price-na-${maxPrice}`);
  if (realtorParams.length) realtorUrl += '/' + realtorParams.join('/');
  links.push({
    source: 'Realtor.com',
    url: realtorUrl,
    title: `${beds ? beds + ' bedroom' : ''} ${location ? 'house in ' + location : 'properties'}${maxPrice ? ' up to $' + (maxPrice/1000000 >= 1 ? (maxPrice/1000000)+'M' : (maxPrice/1000)+'k') : ''}`
  });
  
  // Redfin
  const redfinLocation = location.replace(/\s+/g, '-').replace(',', '');
  let redfinUrl = `https://www.redfin.com/${redfinLocation}/filter/`;
  const redfinParams: string[] = [];
  if (beds) redfinParams.push(`min-beds=${beds}`);
  if (maxPrice) redfinParams.push(`max-price=${maxPrice}`);
  if (redfinParams.length) redfinUrl += redfinParams.join(',');
  links.push({
    source: 'Redfin',
    url: redfinUrl,
    title: `${beds ? beds + ' bedroom' : ''} ${location ? 'house in ' + location : 'properties'}${maxPrice ? ' up to $' + (maxPrice/1000000 >= 1 ? (maxPrice/1000000)+'M' : (maxPrice/1000)+'k') : ''}`
  });
  
  return links;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    const body = await req.json();
    const validationResult = assistantRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input parameters',
          details: validationResult.error.errors 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const { query, categories, properties, marketSnapshot } = validationResult.data;
    
    // Check if this is a property search query
    if (isPropertySearch(query)) {
      const links = buildPropertyLinks(query);
      console.log('Property search detected, returning links:', links);
      return new Response(
        JSON.stringify({ links }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert real estate investment advisor and market analyst specialized in the U.S. housing market.
Your expertise includes property valuation, investment analysis, market trends, renovation cost estimation, and financial modeling.

${properties && properties.length > 0 ? `\n🏘️ PROPERTIES TO ANALYZE: You have ${properties.length} specific properties to review. Focus your analysis on these properties:
${properties.map((p: any, i: number) => `\n${i + 1}. ${p.address}, ${p.city}, ${p.state} - $${p.price.toLocaleString()} | ${p.beds} bed, ${p.baths} bath, ${p.sqft} sqft`).join('')}\n` : ''}

${marketSnapshot ? `\n📊 MARKET SNAPSHOT DATA (${marketSnapshot.areaLabel}):
${marketSnapshot.hasRentcastData ? `\n**RentCast Market Metrics:**
- Median Rent: ${marketSnapshot.medianRent ? `$${marketSnapshot.medianRent.toLocaleString()}/mo` : 'N/A'}
- Median Home Value: ${marketSnapshot.medianHomeValue ? `$${marketSnapshot.medianHomeValue.toLocaleString()}` : 'N/A'}
- Rent-to-Price Ratio: ${marketSnapshot.rentToPriceRatio ? `${(marketSnapshot.rentToPriceRatio * 100).toFixed(2)}%` : 'N/A'}
- Market Trend: ${marketSnapshot.trendLabel || 'N/A'}` : ''}
${marketSnapshot.hasCensusData ? `\n**US Census Demographics (ZIP-level):**
- Median Household Income: ${marketSnapshot.medianHouseholdIncome ? `$${marketSnapshot.medianHouseholdIncome.toLocaleString()}` : 'N/A'}
- Owner-Occupied Rate: ${marketSnapshot.ownerOccupiedRate != null ? `${(marketSnapshot.ownerOccupiedRate * 100).toFixed(1)}%` : 'N/A'}
- Renter-Occupied Rate: ${marketSnapshot.renterOccupiedRate != null ? `${(marketSnapshot.renterOccupiedRate * 100).toFixed(1)}%` : 'N/A'}
- Median Age: ${marketSnapshot.medianAge ? `${marketSnapshot.medianAge.toFixed(1)} years` : 'N/A'}
- Average Household Size: ${marketSnapshot.averageHouseholdSize ? `${marketSnapshot.averageHouseholdSize.toFixed(2)} people` : 'N/A'}` : ''}

**CRITICAL RULES FOR USING MARKET SNAPSHOT DATA:**
- These are FACTUAL area-level statistics from RentCast and US Census Bureau
- Use them to provide neighborhood context and investment analysis
- NEVER extrapolate beyond what's provided - if a field is N/A, say "data not available"
- Reference the source when citing: "According to RentCast..." or "Census data shows..."
- Use this data to assess affordability, investment potential, and neighborhood characteristics
\n` : ''}

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
