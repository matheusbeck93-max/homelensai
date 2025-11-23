import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { properties } = await req.json();

    if (!properties || !Array.isArray(properties) || properties.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 properties required for comparison' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (properties.length > 4) {
      return new Response(
        JSON.stringify({ error: 'Maximum 4 properties can be compared at once' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format properties for AI analysis
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

    console.log('Calling Lovable AI for property comparison...');

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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || 'No analysis generated';

    console.log('Comparison analysis generated successfully');

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compare-properties function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
