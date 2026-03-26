import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage, handleAiGatewayError } from '../_shared/errors.ts';
import { requireEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';

const log = createLogger('compare-properties');

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const { properties } = await req.json();

    if (!properties || !Array.isArray(properties) || properties.length < 2) {
      return validationError('At least 2 properties required for comparison');
    }

    if (properties.length > 4) {
      return validationError('Maximum 4 properties can be compared at once');
    }

    const LOVABLE_API_KEY = requireEnv('LOVABLE_API_KEY');

    const propertyDescriptions = properties.map((p: any, i: number) => {
      return `
**Property ${i + 1}: ${p.address}, ${p.city}, ${p.state}**
- Price: $${p.price?.toLocaleString() || 'N/A'}
- Beds: ${p.beds || 'N/A'} | Baths: ${p.baths || 'N/A'} | Sqft: ${p.sqft?.toLocaleString() || 'N/A'}
- Price per sqft: ${p.price && p.sqft ? `$${(p.price / p.sqft).toFixed(2)}` : 'N/A'}
- Status: ${p.status || 'N/A'}
- Condition: ${p.condition || 'N/A'}
${p.hoa ? `- HOA: $${p.hoa.toLocaleString()}/month` : ''}
${p.yearBuilt ? `- Year Built: ${p.yearBuilt}` : ''}
${p.lotSize ? `- Lot Size: ${p.lotSize.toLocaleString()} sqft` : ''}
      `.trim();
    }).join('\n\n');

    const systemPrompt = `You are a real estate investment analyst comparing multiple properties. Provide a comprehensive comparison that helps buyers make an informed decision.

Structure your response with these sections:

## Quick Summary
Brief overview of each property's key characteristics.

## Best For
- **Best for Families**: [Property name] - Why it's ideal for families
- **Best for Investment**: [Property name] - Why it's the best ROI
- **Best for First-Time Buyers**: [Property name] - Why it's most accessible
- **Best for Long-Term Value**: [Property name] - Why it will appreciate most

## Detailed Comparison

### Location & Neighborhood
Compare locations, commute times, school districts, amenities.

### Value Analysis
Compare price per sqft, overall value, market positioning.

### Investment Potential
Rental yield estimates, appreciation potential, exit strategies.

### Pros & Cons
List 3-4 pros and 3-4 cons for each property.

## Final Recommendation
Clear recommendation based on buyer profile (family, investor, first-time buyer, etc.).

Be specific, use numbers, and provide actionable insights.`;

    const userPrompt = `Compare these ${properties.length} properties:\n\n${propertyDescriptions}`;

    log.step('Calling AI for property comparison');

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
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });

    const gatewayError = handleAiGatewayError(response);
    if (gatewayError) return gatewayError;

    if (!response.ok) {
      log.error('AI API error:', response.status);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || 'No analysis generated';

    log.step('Comparison analysis generated successfully');

    return jsonResponse({ analysis });

  } catch (error) {
    log.error('Error:', error);
    return errorResponse(getErrorMessage(error));
  }
});
