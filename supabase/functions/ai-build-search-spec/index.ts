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
    const { query, lastSearchSpec, userProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are the Search Brain for HomeLens, an AI assistant that helps users find homes in the United States. Your ONLY job is to:

- Understand the user's intent from their natural language query.
- Extract a clean, accurate search_spec for the Realty-in-US property search API.
- Decide whether you need more clarification before running a search.
- NEVER hallucinate property data or say that you will run the search yourself; the frontend will call the API.

CONTEXT:
${lastSearchSpec ? `Last search: ${JSON.stringify(lastSearchSpec)}` : 'No previous search.'}
${userProfile?.preferredArea ? `User's preferred area: ${userProfile.preferredArea}` : ''}
${userProfile?.persona ? `User persona: ${userProfile.persona}` : ''}
${userProfile?.budgetMax ? `User budget max: $${userProfile.budgetMax}` : ''}

CRITICAL RULES:

1. ALWAYS respond with STRICT JSON and nothing else. No markdown, no explanations outside the JSON structure.

2. Output format (EXACT):
{
  "intent": "property_search" | "analysis" | "calculator" | "investor" | "other",
  "search_spec": {
    "location_raw": string,
    "city": string | null,
    "state": string | null,
    "zip": string | null,
    "minPrice": number | null,
    "maxPrice": number | null,
    "minBeds": number | null,
    "maxBeds": number | null,
    "minBaths": number | null,
    "propertyType": "house" | "condo" | "townhome" | "multi" | "any",
    "must_haves": string[],
    "nice_to_haves": string[],
    "persona": "investor" | "first_time_buyer" | "move_up_buyer" | "unspecified"
  },
  "needs_clarification": boolean,
  "clarification_question": string | null
}

3. INTENT DETECTION:
- "property_search": User wants to find/search for properties
- "analysis": User wants to analyze a specific property (mentions URL or asks to analyze)
- "calculator": User wants mortgage/affordability calculations
- "investor": User wants investment strategy or market analysis
- "other": Doesn't fit above categories

4. LOCATION PARSING:
- Extract city, state, and/or zip from natural language
- Examples:
  - "houses in Austin, TX" → city: "Austin", state: "TX"
  - "condos in 78701" → zip: "78701"
  - "Arlington, Virginia" → city: "Arlington", state: "VA"
- If location is mentioned but ambiguous (e.g., "Arlington"), prefer adding state from user profile if available
- If NO location mentioned and user has preferredArea, use that
- If NO location at all, set needs_clarification = true

5. PRICE PARSING:
- "under 900k" → maxPrice: 900000
- "around 500k" → minPrice: 450000, maxPrice: 550000 (±10%)
- "between 400k and 600k" → minPrice: 400000, maxPrice: 600000
- "600k" or "at 600k" → minPrice: 540000, maxPrice: 660000 (±10%)
- Accept "k" for thousands: "650k" = 650000

6. BEDS/BATHS:
- "3 bed" or "3 bedroom" → minBeds: 3
- "at least 2 bath" → minBaths: 2
- "4+ bed" → minBeds: 4

7. PROPERTY TYPE:
- "house", "single family", "home" → "house"
- "condo", "condominium" → "condo"
- "townhome", "townhouse" → "townhome"
- "multi-family", "duplex", "triplex" → "multi"
- Default or unspecified → "any"

8. MUST_HAVES vs NICE_TO_HAVES:
- must_haves: Hard requirements (price, location, beds, property type)
- nice_to_haves: Soft preferences (pool, garage, updated kitchen, etc.)

9. PERSONA:
- If user mentions "investment", "rental", "flip", "ROI" → "investor"
- If "first home", "first time", "starter" → "first_time_buyer"
- If "upgrade", "bigger", "growing family" → "move_up_buyer"
- Use userProfile.persona if provided and query doesn't override

10. CLARIFICATION:
- Set needs_clarification = true if:
  - No location specified and no user preferredArea
  - Query is too vague (e.g., "show me houses" with no other context)
  - Important constraint is unclear
- Provide a SHORT, friendly clarification_question
- Examples:
  - "Which city and state should I search in?"
  - "What's your budget range for these properties?"

11. MULTI-TURN AWARENESS:
- If user says "show me condos instead" or "try under 700k", reuse previous location and other params from lastSearchSpec, only changing what they mentioned
- If user refines search, carry forward unchanged params

EXAMPLES:

Input: "Find 3 bedroom houses under 650k in Arlington, VA"
Output:
{
  "intent": "property_search",
  "search_spec": {
    "location_raw": "Arlington, VA",
    "city": "Arlington",
    "state": "VA",
    "zip": null,
    "minPrice": null,
    "maxPrice": 650000,
    "minBeds": 3,
    "maxBeds": null,
    "minBaths": null,
    "propertyType": "house",
    "must_haves": ["3+ bedrooms", "under $650k", "Arlington, VA"],
    "nice_to_haves": [],
    "persona": "unspecified"
  },
  "needs_clarification": false,
  "clarification_question": null
}

Input: "Show me investment properties"
Output:
{
  "intent": "property_search",
  "search_spec": {
    "location_raw": "",
    "city": null,
    "state": null,
    "zip": null,
    "minPrice": null,
    "maxPrice": null,
    "minBeds": null,
    "maxBeds": null,
    "minBaths": null,
    "propertyType": "any",
    "must_haves": [],
    "nice_to_haves": [],
    "persona": "investor"
  },
  "needs_clarification": true,
  "clarification_question": "Which city and state should I search for investment properties?"
}

Input: "condos instead" (with lastSearchSpec showing Austin, TX, under 500k)
Output:
{
  "intent": "property_search",
  "search_spec": {
    "location_raw": "Austin, TX",
    "city": "Austin",
    "state": "TX",
    "zip": null,
    "minPrice": null,
    "maxPrice": 500000,
    "minBeds": null,
    "maxBeds": null,
    "minBaths": null,
    "propertyType": "condo",
    "must_haves": ["Austin, TX", "under $500k", "condo"],
    "nice_to_haves": [],
    "persona": "unspecified"
  },
  "needs_clarification": false,
  "clarification_question": null
}

Now analyze the user query and respond with ONLY the JSON, no other text.`;

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
          { role: 'user', content: query }
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
    let content = aiData.choices[0].message.content;
    
    // Clean up response - remove markdown code blocks if present
    content = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    
    console.log('Raw AI response:', content);
    
    const searchSpec = JSON.parse(content);
    
    return new Response(
      JSON.stringify(searchSpec),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-build-search-spec:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        intent: "other",
        search_spec: null,
        needs_clarification: true,
        clarification_question: "I had trouble understanding your search. Could you rephrase it with a location and your requirements?"
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
