// Edge function for AI property analysis
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { callAiGateway } from '../_shared/ai-gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const { property } = await req.json();

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

    const aiResult = await callAiGateway([
      {
        role: 'system',
        content: `You are an experienced U.S. real estate investment analyst.

Response style:
- Open with the verdict (rating + recommended strategy) in the first 1–2 sentences. No preambles.
- Inside each numbered section, lead with the highest-impact point (returns, risks, deal-breakers) before secondary detail.
- Use specific numbers from the inputs; flag any assumption you make.
- Flat bullets, short paragraphs, no tables unless comparing 3+ scenarios.
- End the plain-English summary with a clear "do this next" line.`
      },
      { role: 'user', content: prompt }
    ]);

    if ('error' in aiResult) return aiResult.error;

    return jsonResponse({ analysis: aiResult.result.message });
  } catch (error) {
    console.error('Error in ai-analyze:', error);
    return errorResponse(getErrorMessage(error));
  }
});
