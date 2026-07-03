import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { requireEnv } from '../_shared/env.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // Image generation is expensive; charge a flat ~5 credits per call since
    // the Gemini image endpoint does not return a token usage object.
    const credits = await precheckAiCredits(req);
    if (!credits.allowed && credits.response) return credits.response;

    const { prompt, size = "1024x1024", quality = "standard" } = await req.json();
    const LOVABLE_API_KEY = requireEnv('LOVABLE_API_KEY');

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    console.log('Generating image with prompt:', prompt);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: `Generate an image: ${prompt}. Size: ${size}. Quality: ${quality}.`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return errorResponse("Rate limits exceeded, please try again later.", 429);
      }
      if (response.status === 402) {
        return errorResponse("Payment required, please add funds to your workspace.", 402);
      }
      const errorText = await response.text();
      console.error('Image generation error:', response.status, errorText);
      throw new Error(`Image generation failed: ${errorText}`);
    }

    const data = await response.json();
    await deductAiCredits(credits, { total_tokens: 500 });
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract base64 image data if present in the response
    const base64Match = content.match(/data:image\/[^;]+;base64,([^\s"]+)/);
    const imageData = base64Match ? base64Match[1] : content;

    return jsonResponse({ image: imageData, prompt });
  } catch (error) {
    console.error('Error in generate-image:', error);
    return errorResponse(getErrorMessage(error));
  }
});
