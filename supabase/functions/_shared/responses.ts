import { corsHeaders } from './cors.ts';

/**
 * Create a JSON success response with CORS headers.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create a JSON error response with CORS headers.
 */
export function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create a validation error response (400) with details.
 */
export function validationError(message: string, details?: unknown): Response {
  return new Response(
    JSON.stringify({ error: message, ...(details ? { details } : {}) }),
    {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
