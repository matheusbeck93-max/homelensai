import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { requireEnv } from '../_shared/env.ts';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const token = requireEnv('MAPBOX_PUBLIC_TOKEN');
    return jsonResponse({ token });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in get-mapbox-token:', errorMessage);
    return errorResponse(errorMessage);
  }
});
