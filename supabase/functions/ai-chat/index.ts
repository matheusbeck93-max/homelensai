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
    const { messages, hasImage, userProfile, propertyData } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Fetch context from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: programs } = await supabase.from('programs').select('*').limit(5);
    const { data: rates } = await supabase.from('rates').select('*').limit(5);

    const contextInfo = `
Available First-Time Buyer Programs:
${programs?.map(p => `- ${p.name} (${p.jurisdiction}): ${p.eligibility}, Max benefit: $${p.max_benefit}`).join('\n') || 'None'}

Current Mortgage Rates:
${rates?.map(r => `- ${r.product}: ${r.apr}% APR`).join('\n') || 'None'}

**User Profile**: ${userProfile || 'regular-buyer'}
`;

    // Add property-specific context if analyzing a selected property
    const propertyContext = propertyData ? `

**SELECTED PROPERTY ANALYSIS**:
The user has selected this specific property to analyze:
- Address: ${propertyData.address}, ${propertyData.city}, ${propertyData.state}
- Price: $${propertyData.price.toLocaleString()}
- Bedrooms: ${propertyData.beds} | Bathrooms: ${propertyData.baths}
- Square Feet: ${propertyData.sqft}
${propertyData.description ? `- Description: ${propertyData.description}` : ''}

Provide a detailed analysis for this property.
` : '';

    const profileInstructions = {
      'investor': `
**INVESTOR ANALYSIS MODE**:
When analyzing properties for investors, you MUST provide:

1. **Purchase & Renovation Breakdown**:
   - Purchase price
   - Estimated renovation costs (based on property condition from images/description)
   - Closing costs (typically 2-5% of purchase price)
   - Total initial investment

2. **Financing Analysis**:
   - Down payment required (typically 20-25% for investment properties)
   - Mortgage details using current rates (${rates?.find(r => r.product.includes('30'))?.apr || 7}% APR for 30-year)
   - Monthly mortgage payment (P&I)
   - Property taxes (estimate based on location)
   - Insurance costs
   - HOA fees (if applicable)

3. **Investment Returns**:
   - After Repair Value (ARV) estimate
   - Potential monthly rental income (research local market rates)
   - Cash flow analysis (rental income - all expenses)
   - Cap rate calculation
   - ROI percentage
   - Break-even timeline

4. **Exit Strategy**:
   - Recommended hold period
   - Projected sale price in 3-5 years
   - Total profit estimate
   - Flip vs. rent recommendation

5. **Risk Assessment**:
   - Market conditions
   - Property condition concerns
   - Neighborhood factors
   - Competition analysis

Format with clear numbers, calculations, and professional recommendations.`,
      
      'first-time-buyer': `
**FIRST-TIME BUYER GUIDANCE MODE**:
Focus on helping the buyer understand:
- Affordability based on the 28/36 rule
- Down payment options and assistance programs available
- Estimated monthly payments including PMI if <20% down
- Closing costs breakdown
- Move-in ready vs. fixer-upper considerations
- Neighborhood quality and schools
- Long-term value and appreciation potential
- Step-by-step buying process`,
      
      'regular-buyer': `
**REGULAR BUYER MODE**:
Provide balanced analysis covering:
- Property value and market comparison
- Monthly payment estimates
- Neighborhood and lifestyle fit
- Maintenance and upkeep considerations
- Resale potential
- Overall value assessment`
    };

    const systemPrompt = `You are an expert real estate AI assistant specializing in:

🏡 **Property Analysis & Investment**
- Analyze property details, photos, and market positioning
- Calculate ROI, cash flow, and investment potential
- Identify renovation opportunities and flip strategies
- Evaluate rental income potential and cap rates

💰 **Mortgages & Financing**
- Explain loan types, rates, and qualification requirements
- Calculate monthly payments and total costs
- Advise on down payments and closing costs
- Recommend first-time buyer programs and assistance

📊 **Market Intelligence**
- Provide current market trends and price analysis
- Compare neighborhoods and property values
- Identify investment opportunities
- Explain tax implications and deductions

🎯 **Strategy & Guidance**
- Develop custom investment strategies
- Advise on timing and negotiation
- Explain legal and regulatory aspects
- Guide first-time buyers through the process

**Property Search Integration:**
When users ask to search for properties or want to see listings, respond with:
"I can help you search for properties in any location!"

**IMPORTANT**: When user wants to see property results, respond with a special marker that triggers the property carousel:
Use this exact format: "SHOW_PROPERTIES:[location]"
Example: "SHOW_PROPERTIES:Miami, FL" or "SHOW_PROPERTIES:Los Angeles, CA"

**Current Market Data:**
${contextInfo}
${propertyContext}

${profileInstructions[userProfile as keyof typeof profileInstructions] || profileInstructions['regular-buyer']}

${hasImage ? '\n**IMAGE ANALYSIS MODE**: The user has uploaded a property image. Analyze it thoroughly for:\n- Property condition and quality\n- Visible features and upgrades\n- Estimated renovation needs\n- Market appeal and positioning\n' : ''}

Provide detailed, actionable advice with specific numbers when possible. If analyzing a property, give comprehensive investment analysis including potential returns, risks, and recommendations.`;

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
          ...messages
        ],
      }),
    });

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ response: assistantResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
