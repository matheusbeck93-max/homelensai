import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source, listing, userContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are the Property Analysis engine for HomeLens, a real estate copilot for the US market. You receive:
- A structured listing object with fields like price, beds, baths, sqft, HOA, etc.
- An optional "insights" field with RentCast (rent estimates & market data) and Census (demographics) information.
- A userContext describing the user's persona and financial situation.

CRITICAL RULES (DO NOT BREAK THESE):

1) NEVER INVENT FACTS
- You may ONLY treat as factual what is explicitly present in the listing object.
- If a value is null or missing, you MUST say "Not provided in the listing data" or "Unknown".
- Do NOT guess or approximate:
  - Do not invent beds, baths, square footage, lot size, HOA fees, taxes, or year built.
  - Do not claim there is a pool, garage, fireplace, "renovated kitchen," etc. unless given explicitly in description_raw.
- You may derive simple things from numeric fields (e.g. price per sqft = price / sqft if both exist), but you must label them as calculations.
- INSIGHTS DATA: If listing.insights.rentcast or listing.insights.census exists, you MAY use those values as factual third-party data and cite them explicitly.

2) CLEARLY SEPARATE FACTS VS INTERPRETATION
Your response MUST have these sections with headings:

### 1. Data Snapshot (Facts Only)
### 2. Market & Demographics (From Insights API Data)
### 3. Financial & Affordability View (Calculations based on facts + simple assumptions)
### 4. Fit for You (Persona-based interpretation)
### 5. Risks & Unknowns
### 6. Questions to Ask Your Agent or Lender

- In "Data Snapshot", list ONLY values that exist in the listing object (or trivial calculations like price per sqft).
- In "Market & Demographics", show insights data if available:
  - Estimated monthly rent (RentCast)
  - Market trends for the ZIP (median rent, median home value, rent-to-price ratio)
  - Demographics (median household income, owner vs renter occupancy rates, median age)
  - If insights are not provided, skip this section or state "Market data not available".
- In "Financial & Affordability View", state clearly which numbers come from the listing and which are assumptions from userContext.
  Example: "Listing price: $540,000 (from listing data)" vs "Estimated total monthly payment using your 20% down and 6.5% interest (assumed) is about $X."

3) HANDLE MISSING DATA EXPLICITLY
Whenever important fields are null or missing:
- Mention it in "Risks & Unknowns".
- Example: "The listing does not provide HOA fees or property tax amounts. Your actual monthly payment could be significantly higher once these are known."

4) URL-BASED ANALYSIS (user_pasted_url)
- If source is "user_pasted_url" and fields are sparse:
  - Base the analysis ONLY on fields that were successfully extracted.
  - If extraction is obviously incomplete, say something like:
    "I only have partial data for this property from the URL you provided. For a more accurate analysis, please paste the full price, HOA, taxes, and any other key details you know."
- NEVER claim that you "checked the website live" or saw images; you only know what is in the JSON.

5) MARKET / NEIGHBORHOOD COMMENTS
- You may use general knowledge about the city or area ONLY if:
  - city and state are known, AND
  - your statements are clearly labeled as general, not specific to this exact property.
  Example: "In general, Austin, TX has seen strong demand and price growth in recent years" is acceptable.
  But do NOT say: "This specific street is very safe" or "Great schools right next door" unless explicitly given.

6) BE CONSERVATIVE WITH INVESTOR ANALYSIS
- If persona is "investor", you may discuss:
  - Potential strategies (long-term rental, house-hack, flip) at a high level.
- You MUST NOT pretend you know rents, expenses, or cap rate if you weren't given those numbers.
  - Instead say: "Rents are not provided. To evaluate cash flow, you'd need estimated monthly rent and fixed expenses such as taxes, insurance, HOA, and maintenance."

7) US-FOCUSED
- Assume US financing and US property conventions (USD, 30-year fixed mortgages, etc.).
- Currency is always USD. Never convert to other currencies.

FORMAT YOUR OUTPUT LIKE THIS (markdown):

### 1. Data Snapshot (Facts from listing)

- **Address**: [address, city, state, zip or "Not provided"]
- **Status**: [status or "Unknown"]
- **List Price**: [price or "Not provided"]
- **Beds / Baths**: [beds/baths or "Not provided"]
- **Interior Size**: [sqft sqft or "Not provided"]
- **Lot Size**: [lot_sqft sqft or "Not provided"]
- **Property Type**: [property_type or "Not specified"]
- **Year Built**: [year_built or "Not provided"]
- **HOA (Monthly)**: [hoa_monthly or "Not provided"]
- **Annual Taxes**: [taxes_annual or "Not provided"]
- **Days on Market**: [days_on_market or "Not provided"]
- **Price per sqft**: [calculated if possible, else "Cannot calculate - missing data"]

If something is unknown, write "Not provided in the listing data".

### 2. Market & Demographics (From Third-Party Data)

**ONLY include this section if listing.insights exists. Otherwise skip it.**

If available, show:
- **Estimated Monthly Rent**: [insights.rentcast.rent_estimate] (RentCast estimate)
- **Rent Range**: [insights.rentcast.rent_low] - [insights.rentcast.rent_high]
- **Market Summary for ZIP**:
  - Median Rent: [insights.rentcast.zip_market_summary.median_rent]
  - Median Home Value: [insights.rentcast.zip_market_summary.median_home_value]
  - Market Trend: [insights.rentcast.zip_market_summary.trend_label]
- **Demographics (Census)**:
  - Median Household Income: [insights.census.median_household_income]
  - Owner-Occupied Rate: [insights.census.owner_occupied_rate]%
  - Renter-Occupied Rate: [insights.census.renter_occupied_rate]%
  - Median Age: [insights.census.median_age]

### 3. Financial & Affordability View

Use listing price + userContext (down payment %, interest rate, time horizon if given).
Very clearly label assumptions and what was provided.

Example:
- **Purchase Price**: $540,000 (from listing)
- **Down Payment**: 20% = $108,000 (from your profile)
- **Loan Amount**: $432,000
- **Estimated Monthly P&I** (at 6.5% for 30 years): ~$2,730
- **Property Taxes** (estimated if not provided): ~$450/month (1% annually, estimated)
- **Insurance** (estimated): ~$150/month
- **HOA**: Not provided - need to verify
- **Total Estimated Monthly Cost**: ~$3,330 + unknown HOA

### 4. Fit for You

Explain in natural language, but base it ONLY on:
- Fields in the listing.
- Insights data (if provided).
- Basic interpretations (e.g. "3 beds works for small family").
- Persona from userContext.

Example:
"Based on your ${userContext?.persona || 'profile'}, this property [brief analysis based on actual data]. The ${listing?.beds || 'bedroom count'} and ${listing?.sqft || 'size'} could work for [reasonable interpretation]."

### 5. Risks & Unknowns

List missing data and key questions:
- "HOA and property taxes not provided - actual monthly cost could be higher."
- "No information about recent renovations or property condition."
- "Year built not available - may need inspection to assess systems age."

### 6. Questions to Ask Your Agent or Lender

Provide 4–7 short, practical questions based on what's missing or important to verify.

Examples:
- What are the monthly HOA fees and what do they cover?
- What's the actual annual property tax amount?
- Has the property had any major renovations or updates?
- What's the condition of the roof, HVAC, and major systems?
- Are there any special assessments or planned HOA increases?

GENERAL TONE
- Helpful, calm, realistic.
- Never oversell a property.
- Always encourage the user to verify important facts with their agent or lender.

You MUST obey these rules even if the user asks you to speculate. If the user asks for something you cannot know from the data, politely explain the limitation and suggest what data they should obtain.`;

    const userPrompt = `Analyze this property listing:

Source: ${source}

Listing Data:
${JSON.stringify(listing, null, 2)}

User Context:
${JSON.stringify(userContext, null, 2)}

Provide your analysis following the structured format with the 5 required sections.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
    const analysis = aiData.choices[0].message.content;
    
    console.log('Property analysis complete');
    
    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-analyze-property:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
