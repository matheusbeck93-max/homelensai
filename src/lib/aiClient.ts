/**
 * AI Client Abstraction Layer
 * Centralizes all LLM API calls for easy model switching
 * Uses Lovable AI Gateway with google/gemini-2.5-flash
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface AIClientConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  message: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, any>;
  }>;
}

/**
 * Call the configured LLM model via Lovable AI Gateway
 * Note: This client is for edge functions only. Frontend code should
 * call edge functions which then use LOVABLE_API_KEY on the backend.
 */
export async function callModel(
  messages: AIMessage[],
  tools?: AITool[],
  config: AIClientConfig = {},
  apiKey?: string
): Promise<AIResponse> {
  const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
  const model = config.model || 'google/gemini-2.5-flash';
  
  if (!apiKey) {
    throw new Error('API key is required (LOVABLE_API_KEY)');
  }

  const requestBody: any = {
    model,
    messages,
  };

  if (config.maxTokens) {
    requestBody.max_tokens = config.maxTokens;
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI API failed: ${response.status}`, errorText);
    throw new Error(`AI API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices[0];
  
  if (!choice) {
    throw new Error('No response from AI model');
  }

  const result: AIResponse = {
    message: choice.message.content || '',
  };

  // Parse tool calls if present
  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    result.toolCalls = choice.message.tool_calls.map((tc: any) => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }

  return result;
}

/**
 * Sanitize AI response to prevent JSON leakage into chat UI
 */
export function sanitizeMessage(message: string): string {
  let cleaned = message.trim();
  cleaned = cleaned.replace(/\\{[^}]*\\"searchParams\\"[^}]*\\}/g, '');
  cleaned = cleaned.replace(/\\{[^}]*\\"type\\"[^}]*\\}/g, '');
  cleaned = cleaned.replace(/\s\s+/g, ' ').trim();
  return cleaned;
}
