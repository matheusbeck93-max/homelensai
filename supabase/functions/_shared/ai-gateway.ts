import { requireEnv } from './env.ts';
import { handleAiGatewayError } from './errors.ts';

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
