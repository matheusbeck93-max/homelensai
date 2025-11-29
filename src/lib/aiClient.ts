/**
 * AI Client Abstraction Layer
 * Centralizes all LLM API calls for easy model switching
 * Currently uses OpenAI, can be switched to Lovable AI Gateway by editing this file only
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
 * Call the configured LLM model
 * @param messages - Conversation history
 * @param tools - Optional tool definitions
 * @param config - Optional configuration overrides
 * @param apiKey - API key (required for OpenAI, optional for Lovable AI Gateway)
 */
export async function callModel(
  messages: AIMessage[],
  tools?: AITool[],
  config: AIClientConfig = {},
  apiKey?: string
): Promise<AIResponse> {
  // === CURRENT IMPLEMENTATION: OpenAI ===
  // To switch to Lovable AI Gateway, replace this entire section
  // with fetch to https://ai.gateway.lovable.dev/v1/chat/completions
  // and use model: "google/gemini-2.5-flash" instead
  
  const OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions';
  const model = config.model || 'gpt-4o-mini';
  
  if (!apiKey) {
    throw new Error('API key is required for OpenAI');
  }

  const requestBody: any = {
    model,
    messages,
  };

  // Add optional parameters
  if (config.maxTokens) {
    requestBody.max_tokens = config.maxTokens;
  }
  
  // Note: temperature not supported on newer models (GPT-5, O3, etc.)
  // Only add for legacy models that support it
  if (config.temperature !== undefined && model.includes('gpt-4o')) {
    requestBody.temperature = config.temperature;
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  const response = await fetch(OPENAI_BASE_URL, {
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
 * Removes technical data structures from user-facing messages
 */
export function sanitizeMessage(message: string): string {
  // Remove JSON-like structures that might confuse users
  // Keep readable text only
  let cleaned = message.trim();
  
  // Remove common JSON artifacts
  cleaned = cleaned.replace(/\\{[^}]*\\"searchParams\\"[^}]*\\}/g, '');
  cleaned = cleaned.replace(/\\{[^}]*\\"type\\"[^}]*\\}/g, '');
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s\s+/g, ' ').trim();
  
  return cleaned;
}
