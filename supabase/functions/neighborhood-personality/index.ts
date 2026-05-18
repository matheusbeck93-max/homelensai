import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { callAiGateway } from '../_shared/ai-gateway.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const credits = await precheckAiCredits(req, 'neighborhood-personality');
    if (!credits.allowed && credits.response) return credits.response;

    const { address, city, state, zip } = await req.json();

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

    console.log('Calling AI for neighborhood personality...');

    const aiResult = await callAiGateway(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { temperature: 0.8, max_tokens: 1500 }
    );

    if ('error' in aiResult) return aiResult.error;

    await deductAiCredits(credits, aiResult.result.usage);

    console.log('Neighborhood personality generated successfully');
    return jsonResponse({ personality: aiResult.result.message });

  } catch (error) {
    console.error('Error in neighborhood-personality function:', error);
    return errorResponse(getErrorMessage(error));
  }
});
