/**
 * web_research tool — Sonnet-callable Perplexity proxy.
 *
 * Exposed to the model as a `web_research` function tool. When the model
 * decides a question needs live web data (market trends, current rates,
 * recent news, neighborhood comps, etc.) it emits a tool_call and the
 * caller executes `runWebResearch` to fetch a grounded answer from
 * Perplexity Sonar. The text + citations are passed back as a tool_result
 * for Sonnet to compose the final user-facing answer.
 *
 * Kept intentionally small — the orchestration loop lives in the caller
 * (ai-chat extension branch) so other surfaces can opt in selectively.
 */

export const WEB_RESEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'web_research',
    description:
      'Search the live web via Perplexity Sonar when the user question requires up-to-date facts (current mortgage rates, recent market stats, news from the last few weeks, neighborhood-specific data, school ratings, etc.). Do NOT call for evergreen real-estate knowledge or anything you already know reliably.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A focused, self-contained search query (15-25 words). Include city/state when geographic.',
        },
        recency: {
          type: 'string',
          enum: ['day', 'week', 'month', 'year'],
          description: 'Optional. How fresh the data must be. Omit if not time-sensitive.',
        },
      },
      required: ['query'],
    },
  },
};

export interface WebResearchResult {
  answer: string;
  citations: string[];
  ok: boolean;
  error?: string;
}

/** Call Perplexity Sonar with a focused query. Fail-soft. */
export async function runWebResearch(
  input: { query?: unknown; recency?: unknown },
): Promise<WebResearchResult> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) {
    return { ok: false, answer: '', citations: [], error: 'PERPLEXITY_API_KEY missing' };
  }
  const query = typeof input.query === 'string' ? input.query.trim().slice(0, 400) : '';
  if (!query) {
    return { ok: false, answer: '', citations: [], error: 'empty query' };
  }
  const recency = ['day', 'week', 'month', 'year'].includes(String(input.recency))
    ? String(input.recency)
    : undefined;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content:
              'You are a research backend. Return a tight, factual answer (under 200 words) with the most relevant numbers and dates. No greetings, no caveats about being an AI.',
          },
          { role: 'user', content: query },
        ],
        ...(recency ? { search_recency_filter: recency } : {}),
        max_tokens: 500,
      }),
    });
    if (!res.ok) {
      return { ok: false, answer: '', citations: [], error: `perplexity ${res.status}` };
    }
    const data = await res.json();
    const answer = String(data?.choices?.[0]?.message?.content ?? '').trim();
    const citations: string[] = Array.isArray(data?.citations)
      ? data.citations.filter((c: unknown): c is string => typeof c === 'string').slice(0, 5)
      : [];
    return { ok: true, answer, citations };
  } catch (err) {
    return {
      ok: false,
      answer: '',
      citations: [],
      error: err instanceof Error ? err.message : 'perplexity failed',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}