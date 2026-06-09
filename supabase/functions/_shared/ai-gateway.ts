import { requireEnv } from './env.ts';
import { handleAiGatewayError } from './errors.ts';
import {
  completeWithFallback,
  BudgetExceededError,
} from './ai/router.ts';
import { buildBudgetExceededPayload, checkBudget } from './ai/budgetGuard.ts';
import { consumeAnyCredits } from './credits.ts';
import { ProviderError } from './ai/types.ts';
import type { SurfaceId } from './ai/surfaceConfig.ts';
import type { Tier } from './ai/types.ts';
import { errorResponse } from './responses.ts';
import { corsHeaders } from './cors.ts';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | any[];
}

export interface AiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface AiRequestOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: AiTool[];
  tool_choice?: any;
  /**
   * When set and the corresponding `AI_ROUTER_<SURFACE>_ENABLED=1` env flag is on,
   * the call is routed through `completeWithFallback` (P1 router) instead of the
   * legacy raw-fetch gateway path. On unexpected router failures we fall through
   * to the legacy path so the surface degrades gracefully.
   */
  router?: {
    surface: SurfaceId;
    userId: string;
    tier: Tier;
  };
}

export interface AiCompletionResult {
  message: string;
  /**
   * Token usage from the upstream model. Required for `deductAiCredits()`
   * — callers that don't deduct usage will under-charge (the credits
   * helper falls back to the 1-credit floor).
   */
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, any>;
  }>;
  raw: any;
}

/**
 * Call the Lovable AI Gateway and return the parsed result.
 * Throws on non-retryable errors.
 * Returns { error: Response } for handled gateway errors (429, 402).
 */
export async function callAiGateway(
  messages: AiMessage[],
  options: AiRequestOptions = {},
): Promise<{ result: AiCompletionResult } | { error: Response }> {
  // Router path. When `router` is supplied we always route through
  // completeWithFallback so every surface lands on the canonical Sonnet
  // model (legacy `isSurfaceEnabled` gating removed — Sonnet is now the
  // default for the entire app). Falls through to legacy gateway only on
  // unexpected router errors.
  if (options.router) {
    try {
      // Pre-check: when daily cap is hit but the user has credits, the
      // router will admit the call. We need to remember that so we can
      // deduct from credits after a successful response.
      let usedCredits = false;
      try {
        const status = await checkBudget(options.router.userId, options.router.tier);
        usedCredits = Boolean(status.usedCredits);
      } catch { /* fail-open */ }
      const { system, userMessages } = splitSystemFromMessages(messages);
      const routed = await completeWithFallback(
        options.router.surface,
        {
          system,
          messages: userMessages,
          maxTokens: options.max_tokens,
          temperature: options.temperature,
          tools: options.tools?.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          })),
          toolChoice: options.tool_choice,
        },
        { userId: options.router.userId, tier: options.router.tier },
      );
      // Successful call admitted via credits → deduct after the fact.
      if (usedCredits && typeof routed.usage?.costUsd === 'number' && routed.usage.costUsd > 0) {
        // Fire-and-forget — debits plan credits first, then top-ups.
        void consumeAnyCredits(options.router.userId, routed.usage.costUsd);
      }
      const result: AiCompletionResult = {
        message: routed.text,
        usage: {
          prompt_tokens: routed.usage.inputTokens,
          completion_tokens: routed.usage.outputTokens,
          total_tokens: routed.usage.inputTokens + routed.usage.outputTokens,
        },
        raw: routed,
      };
      if (routed.toolCalls?.length) {
        result.toolCalls = routed.toolCalls.map((tc) => ({
          name: tc.name,
          arguments: tc.arguments ?? {},
        }));
      }
      return { result };
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        const body = await buildBudgetExceededPayload(err);
        return {
          error: new Response(JSON.stringify(body), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }),
        };
      }
      if (err instanceof ProviderError && err.status === 429) {
        return { error: errorResponse('Rate limits exceeded, please try again later.', 429) };
      }
      console.error('[ai-gateway] router path failed, falling back:', (err as Error)?.message);
    }
  }

  const apiKey = requireEnv('LOVABLE_API_KEY');
  const model = options.model || 'google/gemini-2.5-flash';

  const body: Record<string, any> = {
    model,
    messages,
  };

  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.max_tokens !== undefined) body.max_tokens = options.max_tokens;
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.tool_choice ?? 'auto';
  }

  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const handled = handleAiGatewayError(response);
    if (handled) return { error: handled };

    const errorText = await response.text();
    console.error(`AI Gateway error: ${response.status}`, errorText);
    throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice?.message) {
    throw new Error('Invalid response format from AI Gateway');
  }

  const result: AiCompletionResult = {
    message: choice.message.content || '',
    usage: {
      prompt_tokens: data.usage?.prompt_tokens,
      completion_tokens: data.usage?.completion_tokens,
      total_tokens: data.usage?.total_tokens,
    },
    raw: data,
  };

  if (choice.message.tool_calls?.length > 0) {
    result.toolCalls = choice.message.tool_calls.map((tc: any) => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }

  return { result };
}

function splitSystemFromMessages(messages: AiMessage[]): { system?: string; userMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }> } {
  let system: string | undefined;
  const userMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }> = [];
  for (const m of messages) {
    if (m.role === 'system' && system === undefined && typeof m.content === 'string') {
      system = m.content;
      continue;
    }
    userMessages.push({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    });
  }
  return { system, userMessages };
}
