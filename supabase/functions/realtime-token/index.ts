import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { requireEnv } from '../_shared/env.ts';
import { getErrorMessage } from '../_shared/errors.ts';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
    const { instructions, voice = "alloy" } = await req.json();

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
      throw new Error(`Failed to create realtime session: ${errorText}`);
    }

    const data = await response.json();
    console.log("Realtime session created successfully");

    return jsonResponse(data);
  } catch (error) {
    console.error("Error in realtime-token:", error);
    return errorResponse(getErrorMessage(error));
  }
});
