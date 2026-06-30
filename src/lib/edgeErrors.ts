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
    // Fallback: some supabase-js versions expose status directly on the error
    // or have already consumed `context`. Try those before giving up.
    const status: number | undefined =
      error?.status ?? error?.statusCode ?? error?.context?.status;
    let body: any = undefined;
    if (ctx && typeof ctx.json === 'function') {
      try { body = await ctx.json(); } catch { /* ignore */ }
    }
    if (status || body) return { status, body };
  } catch {
    /* ignore */
  }
  return {};
}

export function isCreditsExhausted(parsed: ParsedEdgeError): boolean {
  if (!parsed) return false;
  if (parsed.status === 429) return true;
  // PR #6: 402 QUOTA_EXCEEDED (per-feature monthly quota) and the legacy
  // `feature_quota_exceeded` shape both signal a hard credit ceiling that
  // the user must upgrade past. BUDGET_EXCEEDED is handled by budgetCap.ts
  // (we don't surface it as "credits exhausted" — it has its own blocker).
  if (parsed.status === 402) {
    const b = parsed.body;
    if (b && typeof b === 'object') {
      if (b.code === 'QUOTA_EXCEEDED') return true;
      if (b.error === 'feature_quota_exceeded') return true;
    }
  }
  const body = parsed.body;
  if (body && typeof body === 'object') {
    if (body.limitReached === true) return true;
    if (body.error === 'ai_credits_exhausted') return true;
    if (body.code === 'QUOTA_EXCEEDED') return true;
  }
  if (typeof body === 'string' && /ai_credits_exhausted|limitReached/i.test(body)) {
    return true;
  }
  return false;
}

/** PR #6: detect the canonical BUDGET_EXCEEDED 402 envelope. */
export function isBudgetExceeded(parsed: ParsedEdgeError): boolean {
  if (!parsed) return false;
  const b = parsed.body;
  if (b && typeof b === 'object') {
    if (b.code === 'BUDGET_EXCEEDED') return true;
    if (b.error === 'budget_exceeded') return true;
  }
  return false;
}