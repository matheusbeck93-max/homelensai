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
    const { address, city, state, zip } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a neighborhood expert who creates engaging, human-readable neighborhood personality profiles. 
Your goal is to paint a vivid picture of what it's like to live in this area.

Structure your response with these sections:

## The Vibe
A 2-3 sentence description capturing the essence and personality of the neighborhood. Is it trendy? Family-oriented? Quiet? Bustling?

## Who Lives Here
Describe the typical residents and community feel. Young professionals? Families? Retirees? Mix of all?

## Lifestyle & Culture
What defines daily life here? Coffee culture? Outdoor activities? Nightlife? Family activities? Be specific and vivid.

## The Food Scene
Describe the dining options and food culture. Trendy restaurants? Family diners? Food trucks? Ethnic cuisine?

## Getting Around
How do people typically move around? Walkable? Need a car? Good transit? Bike-friendly?

## Best For
Who would love living here the most? (e.g., "Perfect for young families who want suburban feel with urban access")

Keep it conversational, authentic, and engaging. Use specific examples when possible.`;

    const userPrompt = `Create a neighborhood personality profile for: ${address}, ${city}, ${state} ${zip}`;

    console.log('Calling Lovable AI for neighborhood personality...');

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
        temperature: 0.8,
        max_tokens: 1500,
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
    const personality = data.choices?.[0]?.message?.content || 'No personality generated';

    console.log('Neighborhood personality generated successfully');

    return new Response(
      JSON.stringify({ personality }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in neighborhood-personality function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
