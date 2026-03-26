import { errorResponse } from './responses.ts';

/**
 * Handle common AI gateway errors (429, 402) and return appropriate responses.
 * Returns a Response for handled errors, null otherwise.
 */
export function handleAiGatewayError(response: { status: number }): Response | null {
  if (response.status === 429) {
    return errorResponse('Rate limits exceeded, please try again later.', 429);
  }
  if (response.status === 402) {
    return errorResponse('Payment required, please add funds to your workspace.', 402);
  }
  return null;
}

/**
 * Extract a safe error message from an unknown error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Wrap an async handler with standard error handling.
 * Catches errors and returns a JSON error response.
 */
export function withErrorHandler(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error) {
      console.error('Unhandled error:', error);
      return errorResponse(getErrorMessage(error));
    }
  };
}
