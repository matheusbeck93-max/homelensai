/**
 * Shared types for the HomeLens AI provider abstraction.
 *
 * Every concrete provider (currently just LovableGatewayProvider) implements
 * the `ChatProvider` interface. Surfaces talk to the router via these types,
 * never directly to a provider.
 */

import type { ModelId } from "./modelRegistry.ts";

export type Tier = "free" | "paid" | "premium";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** OpenAI-style identifier when this is a tool-result message. */
  tool_call_id?: string;
  /** OpenAI-style identifier when this assistant message issued tool calls. */
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  /** Tool name when role === "tool". */
  name?: string;
}

export interface ChatTool {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. */
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  system?: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  maxTokens?: number;
  temperature?: number;
  /** When "json", asks the model to return a JSON object. */
  responseFormat?: "json" | "text";
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  modelId: ModelId;
}

export type StreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_use_start"; id: string; name: string; input: unknown }
  | { type: "tool_use_result"; id: string; name: string; output: unknown }
  | { type: "done"; usage?: Usage }
  | { type: "error"; message: string; retryable: boolean; status?: number };

export interface CompleteResult {
  text: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  usage: Usage;
}

export interface ChatProvider {
  stream(
    modelId: ModelId,
    req: ChatRequest,
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent>;

  complete(
    modelId: ModelId,
    req: ChatRequest,
    signal?: AbortSignal,
  ): Promise<CompleteResult>;
}

/** Subset of `Error` we throw for non-retryable provider failures. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}