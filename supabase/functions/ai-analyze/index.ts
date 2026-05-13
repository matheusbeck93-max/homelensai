// Edge function for AI property analysis
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { callAiGateway } from '../_shared/ai-gateway.ts';
import { z } from 'https://esm.sh/zod@3.23.8';

const sanitize = (s: unknown, max = 200) =>
  String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, max);

const PropertySchema = z.object({
  address: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  price: z.number().finite().nonnegative().optional(),
  beds: z.number().finite().nonnegative().optional(),
  baths: z.number().finite().nonnegative().optional(),
  sqft: z.number().finite().nonnegative().optional(),
  condition: z.string().max(120).optional(),
  year_built: z.number().int().optional(),
  arv: z.number().finite().optional(),
  rehab_cost: z.number().finite().optional(),
  roi_percent: z.number().finite().optional(),
}).passthrough();

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = PropertySchema.safeParse(body?.property);
    if (!parsed.success) {
      return validationError('Invalid property payload', parsed.error.flatten().fieldErrors);
    }
    const property = parsed.data;

    const prompt = `Analyze this property investment opportunity and provide a detailed report in plain English:

Property Details:
- Address: ${sanitize(property.address)}, ${sanitize(property.city, 120)}, ${sanitize(property.state, 60)}
- Purchase Price: $${Number(property.price) || 0}
- Bedrooms: ${Number(property.beds) || 0} | Bathrooms: ${Number(property.baths) || 0}
- Square Footage: ${Number(property.sqft) || 0} sqft
- Condition: ${sanitize(property.condition, 120)}
- Year Built: ${Number(property.year_built) || 'unknown'}
${property.arv ? `- After Repair Value (ARV): $${Number(property.arv)}` : ''}
${property.rehab_cost ? `- Estimated Rehab Cost: $${Number(property.rehab_cost)}` : ''}
${property.roi_percent ? `- Estimated ROI: ${Number(property.roi_percent)}%` : ''}

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
- Open with the verdict (rating + recommended strategy) in the first 1–2 sentences. No preambles, no ambiguous "it depends" openers.
- Inside each numbered section, lead with the highest-impact point (returns, risks, deal-breakers) before secondary detail.
- Use specific numbers from the inputs; flag any assumption you make.
- Flat bullets, short paragraphs, no tables unless comparing 3+ scenarios.
- Prefer bullets when they improve scanability — list 3+ supporting points as flat bullets; use short prose for 1–2 connected points.
- Conciseness: cut filler ~15–20%; every sentence must add decision-relevant info.
- The plain-English summary closes with a "do this next" line only when it materially helps the decision — otherwise skip follow-up suggestions.`
      },
      { role: 'user', content: prompt }
    ]);

    if ('error' in aiResult) return aiResult.error;

    return jsonResponse({ analysis: aiResult.result.message });
  } catch (error) {
    console.error('Error in ai-analyze:', error);
    return errorResponse('Unable to complete analysis.', 500);
  }
});
