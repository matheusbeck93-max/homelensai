import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { requireEnv } from '../_shared/env.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }
    const token = requireEnv('MAPBOX_PUBLIC_TOKEN');
    return jsonResponse({ token });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in get-mapbox-token:', errorMessage);
    return errorResponse('Unable to retrieve map token.', 500);
  }
});
