import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { requireEnv } from '../_shared/env.ts';
import { z } from 'https://esm.sh/zod@3.23.8';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';

const RequestSchema = z.object({
  instructions: z.string().max(2000).optional(),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy'),
}).strict();

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // Realtime tokens unlock expensive downstream usage; charge a flat
    // ~5 credits per token issuance.
    const credits = await precheckAiCredits(req);
    if (!credits.allowed && credits.response) return credits.response;

    const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationError('Invalid request body', parsed.error.flatten().fieldErrors);
    }
    const { instructions, voice } = parsed.data;

    // Request an ephemeral token from OpenAI
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: voice,
        instructions: instructions || "You are a helpful real estate assistant. Provide clear, concise advice about properties, mortgages, and real estate investing."
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI realtime session error:', response.status, errorText);
      if (response.status === 429) {
        return errorResponse('Rate limit exceeded. Please try again later.', 429);
      }
      return errorResponse('Voice service temporarily unavailable.', 502);
    }

    const data = await response.json();
    await deductAiCredits(credits, { total_tokens: 500 });
    console.log("Realtime session created successfully");

    return jsonResponse(data);
  } catch (error) {
    console.error("Error in realtime-token:", error);
    return errorResponse('Unable to create voice session.', 500);
  }
});
