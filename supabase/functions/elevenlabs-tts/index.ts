import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { requireEnv } from '../_shared/env.ts';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const { text, voiceId } = await req.json();
    const ELEVENLABS_API_KEY = requireEnv('ELEVENLABS_API_KEY');

    if (!text || text.trim().length === 0) {
      return validationError('Text is required');
    }

    // Default to Eric voice
    const selectedVoice = voiceId || 'cjVigY5qzO86Huf0OWal';

    // Use streaming endpoint + turbo model for faster time-to-first-audio
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}/stream?output_format=mp3_22050_32`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.substring(0, 5000),
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

    // Stream the audio back directly
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
});
