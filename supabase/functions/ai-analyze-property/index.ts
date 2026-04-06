import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage, handleAiGatewayError } from '../_shared/errors.ts';
import { requireEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const log = createLogger('ai-analyze-property');

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const { source, listing, userContext, userId, userTier } = await req.json();
    const LOVABLE_API_KEY = requireEnv('LOVABLE_API_KEY');

    // Enforce daily limits for free tier users
    if (userId && userTier === 'free') {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('daily_analysis_count, daily_analysis_last_reset')
        .eq('id', userId)
        .single();

      if (profileError) {
        log.error('Error fetching profile:', profileError);
        throw new Error('Failed to check analysis limit');
      }

      const today = new Date().toISOString().split('T')[0];
      const lastReset = profile.daily_analysis_last_reset;
      let currentCount = profile.daily_analysis_count || 0;

      if (lastReset !== today) {
        currentCount = 0;
        await supabaseAdmin
          .from('profiles')
          .update({
            daily_analysis_count: 0,
            daily_analysis_last_reset: today
          })
          .eq('id', userId);
      }

      if (currentCount >= 3) {
        return jsonResponse({ 
          error: 'Daily analysis limit reached',
          message: 'You have reached your daily limit of 3 AI analyses. Upgrade to Pro for unlimited analyses.',
          limitReached: true
        }, 429);
      }

      await supabaseAdmin
        .from('profiles')
        .update({
          daily_analysis_count: currentCount + 1
        })
        .eq('id', userId);

      log.step(`Analysis count incremented for user`, { count: currentCount + 1 });
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

3) HANDLE MISSING DATA EXPLICITLY
Whenever important fields are null or missing:
- Mention it in "Risks & Unknowns".

4) URL-BASED ANALYSIS (user_pasted_url)
- If source is "user_pasted_url" and fields are sparse:
  - Base the analysis ONLY on fields that were successfully extracted.
  - NEVER claim that you "checked the website live" or saw images.

5) MARKET / NEIGHBORHOOD COMMENTS
- You may use general knowledge about the city or area ONLY if city and state are known, AND your statements are clearly labeled as general.

6) BE CONSERVATIVE WITH INVESTOR ANALYSIS
- If persona is "investor", you may discuss strategies at a high level.
- You MUST NOT pretend you know rents, expenses, or cap rate if you weren't given those numbers.

7) US-FOCUSED
- Assume US financing and US property conventions (USD, 30-year fixed mortgages, etc.).

GENERAL TONE
- Be concise and direct — avoid verbose introductions or unnecessary padding between sections.
- Prioritize clarity and density of information. Only expand when the analysis genuinely requires it.
- Helpful, calm, realistic.
- Never oversell a property.
- Always encourage the user to verify important facts with their agent or lender.`;

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

    const gatewayError = handleAiGatewayError(response);
    if (gatewayError) return gatewayError;

    if (!response.ok) {
      const errorText = await response.text();
      log.error('AI gateway error:', response.status);
      throw new Error('AI gateway error');
    }

    const aiData = await response.json();
    const analysis = aiData.choices[0].message.content;
    
    log.step('Property analysis complete');
    
    return jsonResponse({ analysis });
  } catch (error) {
    log.error('Error:', error);
    return errorResponse(getErrorMessage(error));
  }
});
