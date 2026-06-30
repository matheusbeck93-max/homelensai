/**
 * TEMP — PR #8 cache verification harness.
 * Sends an identical prompt through completeWithFallback so we can read
 * cache_read_input_tokens from ai_usage_log on subsequent identical calls.
 * Delete after verification.
 */
import { corsHeaders } from '../_shared/cors.ts';
import { completeWithFallback } from '../_shared/ai/router.ts';

const LARGE_SYSTEM = (
  'You are a real-estate research assistant. ' +
  'Always answer in one short paragraph. ' +
  // pad to ~1.5k tokens so Anthropic considers it cache-worthy (min ~1024 tokens for Sonnet caching)
  'Context corpus follows. '.repeat(400)
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  const surface = (url.searchParams.get('surface') ?? 'general_chat') as any;
  const userId = url.searchParams.get('userId') ?? '00000000-0000-0000-0000-000000000000';
  const tier = (url.searchParams.get('tier') ?? 'investor') as any;
  try {
    const res = await completeWithFallback(
      surface,
      {
        system: LARGE_SYSTEM,
        messages: [{ role: 'user', content: 'In one sentence, what is a cap rate?' }],
        maxTokens: 80,
        temperature: 0,
      },
      { userId, tier, isDevCall: true },
      { skipBudgetCheck: true },
    );
    return new Response(
      JSON.stringify({
        ok: true,
        modelId: res.usage.modelId,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        cacheRead: res.usage.cacheReadInputTokens ?? 0,
        cacheCreate: res.usage.cacheCreationInputTokens ?? 0,
        sample: res.text.slice(0, 200),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});