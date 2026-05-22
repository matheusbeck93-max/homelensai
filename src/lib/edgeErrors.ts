/**
 * Helpers to extract structured info from Supabase Edge Function errors.
 * `supabase.functions.invoke` throws `FunctionsHttpError` whose `.message`
 * is just "Edge Function returned a non-2xx status code". The actual JSON
 * body lives on `error.context` (a `Response`).
 */
export interface ParsedEdgeError {
  status?: number;
  body?: any;
}

export async function parseEdgeError(error: any): Promise<ParsedEdgeError> {
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.clone === 'function') {
      const res: Response = ctx.clone();
      let body: any = undefined;
      try {
        body = await res.json();
      } catch {
        try { body = await res.text(); } catch { /* ignore */ }
      }
      return { status: res.status, body };
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function isCreditsExhausted(parsed: ParsedEdgeError): boolean {
  if (!parsed) return false;
  if (parsed.status === 429) return true;
  const body = parsed.body;
  if (body && typeof body === 'object') {
    if (body.limitReached === true) return true;
    if (body.error === 'ai_credits_exhausted') return true;
  }
  return false;
}