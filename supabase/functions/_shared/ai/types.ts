/**
 * Shared types for the HomeLens AI provider abstraction.
 *
 * Every concrete provider (currently just LovableGatewayProvider) implements
 * the `ChatProvider` interface. Surfaces talk to the router via these types,
 * never directly to a provider.
 */

import type { ModelId } from "./modelRegistry.ts";

export type Tier = "free" | "buyer" | "investor";

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
  /**
   * Dynamic/per-request additions to the system prompt. Emitted as a
   * SECOND system block *without* cache_control so that per-user data
   * (memories, active card context, session filters) doesn't invalidate
   * the cached prefix in `system`. Prefer this over concatenating into
   * `system` for anything that changes call-to-call.
   */
  systemDynamic?: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  /**
   * OpenAI-style tool_choice. "auto" (default), "none", "required", or
   * a forced function call: { type: "function", name: "fn_name" }.
   */
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; name: string };
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
  /** Tokens served from Anthropic ephemeral prompt cache (input cost ~10%). */
  cacheReadInputTokens?: number;
  /** Tokens written into the Anthropic ephemeral cache (input cost ~125%). */
  cacheCreationInputTokens?: number;
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