import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { requireEnv } from '../_shared/env.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';
import { enforceFeature } from '../_shared/tierGate.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

// Cap text at the ElevenLabs streaming endpoint's effective limit. Reject
// anything longer instead of silently truncating (the old behavior was
// .substring(0, 5000) which let callers stuff in 100KB and just lost
// the rest).
const MAX_TTS_CHARS = 5000;

// Roughly 200 chars per credit. Adjust against ElevenLabs pricing; this maps
// chars -> the totalTokens field that deductAiCredits expects (the credit
// helper rounds up at 100 tokens/credit, capping at 20 credits/request).
function charsToFakeTokens(chars: number): number {
  return Math.min(chars / 2, 2000);
}

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const gate = await enforceFeature(req, 'VOICE_MODE');
    if (!gate.ok) return gate.error;
    // Auth + credits in one call. Rejects unauthenticated with 401.
    // Previously this function had NO auth and NO rate limiting — anyone
    // could POST { text: '...' } and burn HomeLens's ElevenLabs API quota.
    // See homelens_public_endpoints_fix_prompt.md P0-2.
    const credits = await precheckAiCredits(req, 'elevenlabs-tts');
    if (!credits.allowed && credits.response) return credits.response;

    const { text, voiceId } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return validationError('Text is required');
    }
    if (text.length > MAX_TTS_CHARS) {
      return validationError(`Text exceeds ${MAX_TTS_CHARS} character limit`);
    }

    const ELEVENLABS_API_KEY = requireEnv('ELEVENLABS_API_KEY');
    const selectedVoice = (typeof voiceId === 'string' && voiceId.length <= 100)
      ? voiceId
      : 'cjVigY5qzO86Huf0OWal'; // Eric voice (default)

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}/stream?output_format=mp3_22050_32`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API error: ${response.status}`, errorText);
      throw new Error(`ElevenLabs API failed: ${response.status}`);
    }

    // Deduct credits based on character count (ElevenLabs bills by chars
    // not tokens, so we map to the totalTokens field at a fixed ratio).
    await deductAiCredits(credits, { total_tokens: charsToFakeTokens(text.length) });

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return errorResponse(getErrorMessage(error));
  }
})(req)));
