import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { callAiGateway } from '../_shared/ai-gateway.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';
import { enforceFeature } from '../_shared/tierGate.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const gate = await enforceFeature(req, 'PROPERTY_COMPARISON');
    if (!gate.ok) return gate.error;
    const credits = await precheckAiCredits(req);
    if (!credits.allowed && credits.response) return credits.response;

    const { properties } = await req.json();

    if (!properties || properties.length < 2) {
      return validationError('At least 2 properties required for comparison');
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

Response style:
- First sentence = the winning property + the single strongest reason. No preambles, no ambiguous openers, no restating the question.
- Inside each breakdown, lead with the factor that most affects the decision (cash flow for investors, value/livability for residence buyers).
- Use specific numbers, not adjectives. Skip generic market commentary.
- Flat bullets, max 1 level of nesting. No tables.
- Prefer bullets when they improve scanability — list 3+ pros/cons as flat bullets; use prose for 1–2 connected points or the verdict.
- Conciseness: cut filler ~15–20%; every line must affect the recommendation.
- Skip generic "next step" suggestions unless they materially help the decision.
- Keep it under 400 words.`;

    const userPrompt = `Compare these ${properties.length} properties and recommend the best one:\n\n${propertyDescriptions}`;

    const aiResult = await callAiGateway(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: 0.7,
        ...(credits.userId ? {
          router: {
            surface: 'artifact_generation' as const,
            userId: credits.userId,
            tier: credits.tier === 'unlimited' ? 'investor' as const : (credits.tier === 'paid' ? 'buyer' as const : 'free' as const),
          },
        } : {}),
      }
    );

    if ('error' in aiResult) return aiResult.error;

    if (!aiResult.result.message) {
      throw new Error('No analysis generated');
    }

    await deductAiCredits(credits, aiResult.result.usage);

    return jsonResponse({ analysis: aiResult.result.message, buyerType });

  } catch (error) {
    console.error('Error in compare-properties-ai:', error);
    return errorResponse(getErrorMessage(error));
  }
})(req)));
