import { corsHeaders, buildCorsHeaders } from './cors.ts';

/**
 * Resolve CORS headers. If a Request is provided, echo the request origin
 * when it's allowlisted; otherwise fall back to the static safe-default
 * headers (origin = https://homelens.ai). Always pass `req` from edge
 * functions that are called from preview/lovable.app/localhost origins so
 * the browser doesn't block the response.
 */
function headersFor(req?: Request): Record<string, string> {
  return req ? buildCorsHeaders(req) : corsHeaders;
}

/**
 * Create a JSON success response with CORS headers.
 */
export function jsonResponse(data: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headersFor(req), 'Content-Type': 'application/json' },
  });
}

/**
 * Create a JSON error response with CORS headers.
 */
export function errorResponse(message: string, status = 500, req?: Request): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headersFor(req), 'Content-Type': 'application/json' },
  });
}

/**
 * Create a validation error response (400) with details.
 */
export function validationError(message: string, details?: unknown, req?: Request): Response {
  return new Response(
    JSON.stringify({ error: message, ...(details ? { details } : {}) }),
    {
      status: 400,
      headers: { ...headersFor(req), 'Content-Type': 'application/json' },
    },
  );
}
