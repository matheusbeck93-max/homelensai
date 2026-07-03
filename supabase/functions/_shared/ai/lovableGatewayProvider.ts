/**
 * LovableGatewayProvider — single concrete ChatProvider implementation.
 *
 * Wraps the Lovable AI Gateway (https://ai.gateway.lovable.dev/v1/chat/completions)
 * behind the abstract `ChatProvider` interface so the rest of the codebase
 * never touches an HTTP fetch directly.
 *
 * The gateway is OpenAI-compatible, so request/response shapes mirror the
 * OpenAI chat-completions API. `reasoning_effort` is forwarded for models
 * that support it (GPT-5).
 */

import {
  estimateCostUsd,
  getModelSpec,
  type ModelId,
} from "./modelRegistry.ts";
import {
  type ChatProvider,
  type ChatRequest,
  type CompleteResult,
  ProviderError,
  type StreamEvent,
  type Usage,
} from "./types.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type FetchFn = typeof fetch;

export interface LovableGatewayProviderOptions {
  apiKey?: string;
  fetchImpl?: FetchFn;
  url?: string;
}

export class LovableGatewayProvider implements ChatProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchFn;
  private readonly url: string;

  constructor(opts: LovableGatewayProviderOptions = {}) {
    const key = opts.apiKey ?? Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    this.apiKey = key;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.url = opts.url ?? GATEWAY_URL;
  }

  private buildBody(modelId: ModelId, req: ChatRequest, stream: boolean): Record<string, unknown> {
    const spec = getModelSpec(modelId);
    const messages: Array<Record<string, unknown>> = [];
    // cache_control is Anthropic-proprietary. The Gateway routes to
    // Google/OpenAI models, both of which ignore it (and Anthropic models
    // aren't reachable through the Gateway at all), so we don't send it.
    // Concatenate static + dynamic system prompts. The Gateway ignores
    // Anthropic-style cache_control, so there's no reason to split them
    // into separate blocks here.
    const systemParts: string[] = [];
    if (req.system) systemParts.push(req.system);
    if (req.systemDynamic) systemParts.push(req.systemDynamic);
    if (systemParts.length > 0) {
      messages.push({ role: "system", content: systemParts.join("\n\n") });
    }
    for (const m of req.messages) {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.name) msg.name = m.name;
      messages.push(msg);
    }

    const body: Record<string, unknown> = {
      model: spec.apiName,
      messages,
      stream,
    };
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (spec.reasoningEffort) body.reasoning_effort = spec.reasoningEffort;
    if (req.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = translateToolChoice(req.toolChoice);
    }
    if (stream) {
      body.stream_options = { include_usage: true };
    }
    return body;
  }

  private async sendRequest(body: unknown, stream: boolean, signal?: AbortSignal): Promise<Response> {
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(stream ? { Accept: "text/event-stream" } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const retryable = response.status === 429 || response.status >= 500;
      throw new ProviderError(
        `Gateway ${response.status}: ${text || response.statusText}`,
        response.status,
        retryable,
      );
    }
    return response;
  }

  async complete(modelId: ModelId, req: ChatRequest, signal?: AbortSignal): Promise<CompleteResult> {
    const body = this.buildBody(modelId, req, false);
    const response = await this.sendRequest(body, false, signal);
    const data = await response.json();
    const choice = data?.choices?.[0];
    if (!choice?.message) {
      throw new ProviderError("Invalid gateway response — missing choices[0].message", 502, true);
    }
    const inputTokens = Number(data?.usage?.prompt_tokens ?? 0);
    const outputTokens = Number(data?.usage?.completion_tokens ?? 0);
    // OpenAI-shape cached prompt tokens (when the upstream model supports
    // automatic caching and reports it). Gemini/GPT semantics differ from
    // Anthropic's, but we surface the count for parity.
    const cacheReadInputTokens = Number(
      data?.usage?.prompt_tokens_details?.cached_tokens
        ?? data?.usage?.cached_tokens
        ?? 0,
    );
    const usage: Usage = {
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(modelId, inputTokens, outputTokens),
      modelId,
      cacheReadInputTokens,
      cacheCreationInputTokens: 0,
    };

    const toolCalls = Array.isArray(choice.message.tool_calls)
      ? choice.message.tool_calls.map((tc: any) => ({
          id: String(tc.id ?? ""),
          name: tc.function?.name ?? "",
          arguments: safeJsonParse(tc.function?.arguments) as Record<string, unknown>,
        }))
      : undefined;

    return {
      text: typeof choice.message.content === "string" ? choice.message.content : "",
      toolCalls,
      usage,
    };
  }

  async *stream(modelId: ModelId, req: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const body = this.buildBody(modelId, req, true);
    let response: Response;
    try {
      response = await this.sendRequest(body, true, signal);
    } catch (err) {
      if (err instanceof ProviderError) {
        yield { type: "error", message: err.message, retryable: err.retryable, status: err.status };
        return;
      }
      throw err;
    }
    if (!response.body) {
      yield { type: "error", message: "Empty stream body", retryable: true };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    // tool_calls arrive incrementally as deltas keyed by index.
    const toolBuilders = new Map<number, { id: string; name: string; argsText: string; emitted: boolean }>();
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadInputTokens = 0;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line || !line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          let json: any;
          try {
            json = JSON.parse(payload);
          } catch {
            continue;
          }

          if (json?.usage) {
            inputTokens = Number(json.usage.prompt_tokens ?? inputTokens);
            outputTokens = Number(json.usage.completion_tokens ?? outputTokens);
            const cached = Number(
              json.usage?.prompt_tokens_details?.cached_tokens
                ?? json.usage?.cached_tokens
                ?? 0,
            );
            if (cached > 0) cacheReadInputTokens = cached;
          }

          const choice = json?.choices?.[0];
          const delta = choice?.delta;
          if (!delta) continue;

          if (typeof delta.content === "string" && delta.content.length > 0) {
            yield { type: "text_delta", delta: delta.content };
          }

          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = Number(tc.index ?? 0);
              const existing = toolBuilders.get(idx) ?? { id: "", name: "", argsText: "", emitted: false };
              if (tc.id) existing.id = String(tc.id);
              if (tc.function?.name) existing.name = String(tc.function.name);
              if (typeof tc.function?.arguments === "string") existing.argsText += tc.function.arguments;
              toolBuilders.set(idx, existing);
            }
          }

          if (choice.finish_reason === "tool_calls") {
            for (const tb of toolBuilders.values()) {
              if (tb.emitted) continue;
              tb.emitted = true;
              yield {
                type: "tool_use_start",
                id: tb.id,
                name: tb.name,
                input: safeJsonParse(tb.argsText),
              };
            }
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch { /* noop */ }
    }

    const usage: Usage = {
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(modelId, inputTokens, outputTokens),
      modelId,
      cacheReadInputTokens,
      cacheCreationInputTokens: 0,
    };
    yield { type: "done", usage };
  }
}

function safeJsonParse(s: string | undefined): unknown {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return { _raw: s };
  }
}

function translateToolChoice(
  choice: ChatRequest["toolChoice"],
): unknown {
  if (!choice || choice === "auto") return "auto";
  if (choice === "none" || choice === "required") return choice;
  if (typeof choice === "object" && choice.type === "function") {
    return { type: "function", function: { name: choice.name } };
  }
  return "auto";
}