/**
 * AnthropicProvider — direct adapter to https://api.anthropic.com/v1/messages
 *
 * Implements the same ChatProvider interface as LovableGatewayProvider so the
 * router can dispatch by ModelSpec.provider without surfaces noticing.
 * Translates OpenAI-shape ChatMessage/ChatTool into Anthropic content blocks
 * and back, and emits the same StreamEvent shape used elsewhere.
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

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Sonnet + Haiku ephemeral cache minimum is 1024 input tokens. Attaching
 * `cache_control` to a block below that returns HTTP 400 on some model
 * versions (Haiku 4.5 rejected all 14 memory_categorization calls on
 * 2026-06-29). Rough heuristic: 1 token ≈ 4 chars for English prose, so
 * gate cache_control at ~4200 chars to stay safely above the 1024 floor.
 */
const CACHE_CONTROL_MIN_CHARS = 4200;

function shouldCacheSystem(text: string): boolean {
  return text.length >= CACHE_CONTROL_MIN_CHARS;
}

type FetchFn = typeof fetch;

export interface AnthropicProviderOptions {
  apiKey?: string;
  fetchImpl?: FetchFn;
  url?: string;
}

export class AnthropicProvider implements ChatProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchFn;
  private readonly url: string;

  constructor(opts: AnthropicProviderOptions = {}) {
    this.apiKey = opts.apiKey ?? Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.url = opts.url ?? ANTHROPIC_URL;
  }

  private buildBody(modelId: ModelId, req: ChatRequest, stream: boolean): Record<string, unknown> {
    const spec = getModelSpec(modelId);

    // Anthropic uses a top-level `system` field, not a system message.
    const systemParts: string[] = [];
    if (req.system) systemParts.push(req.system);

    const messages: Array<Record<string, unknown>> = [];
    for (const m of req.messages) {
      if (m.role === "system") {
        if (typeof m.content === "string" && m.content.length > 0) systemParts.push(m.content);
        continue;
      }
      if (m.role === "tool") {
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: m.tool_call_id ?? "",
              content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
            },
          ],
        });
        continue;
      }
      if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
        const blocks: Array<Record<string, unknown>> = [];
        if (typeof m.content === "string" && m.content.length > 0) {
          blocks.push({ type: "text", text: m.content });
        }
        for (const tc of m.tool_calls) {
          let input: unknown = {};
          try {
            input = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
          } catch {
            input = {};
          }
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function?.name ?? "",
            input,
          });
        }
        messages.push({ role: "assistant", content: blocks });
        continue;
      }
      messages.push({ role: m.role, content: m.content });
    }

    const body: Record<string, unknown> = {
      model: spec.apiName,
      max_tokens: req.maxTokens ?? 4096,
      messages,
      stream,
    };
    if (systemParts.length > 0) {
      const systemText = systemParts.join("\n\n");
      const systemBlock: Record<string, unknown> = {
        type: "text",
        text: systemText,
      };
      if (shouldCacheSystem(systemText)) {
        systemBlock.cache_control = { type: "ephemeral" };
      }
      body.system = [systemBlock];
    }
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.tools && req.tools.length > 0) {
      // Only mark the LAST tool with cache_control. Anthropic caches every
      // block up to and including the marked one, so a single marker at
      // the end covers the full tool array. Also skip cache_control when
      // the serialized payload is well under the 1024-token minimum.
      const toolPayloadChars = req.tools.reduce(
        (sum, t) =>
          sum + (t.name?.length ?? 0) + (t.description?.length ?? 0) +
          JSON.stringify(t.parameters ?? {}).length,
        0,
      );
      const cacheTools = toolPayloadChars >= CACHE_CONTROL_MIN_CHARS;
      body.tools = req.tools.map((t, idx) => {
        const block: Record<string, unknown> = {
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        };
        if (cacheTools && idx === req.tools!.length - 1) {
          block.cache_control = { type: "ephemeral" };
        }
        return block;
      });
      body.tool_choice = translateToolChoice(req.toolChoice);
    }
    return body;
  }

  private async sendRequest(body: unknown, stream: boolean, signal?: AbortSignal): Promise<Response> {
    if (!this.apiKey) {
      throw new ProviderError("ANTHROPIC_API_KEY is not configured", 500, false);
    }
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
        ...(stream ? { Accept: "text/event-stream" } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const requestId = response.headers.get("request-id") ?? response.headers.get("x-request-id") ?? undefined;
      const retryable = response.status === 429 || response.status >= 500;
      const msg = `Anthropic ${response.status}${requestId ? ` [req=${requestId}]` : ""}: ${(text || response.statusText).slice(0, 500)}`;
      throw new ProviderError(msg, response.status, retryable);
    }
    return response;
  }

  async complete(modelId: ModelId, req: ChatRequest, signal?: AbortSignal): Promise<CompleteResult> {
    const body = this.buildBody(modelId, req, false);
    const response = await this.sendRequest(body, false, signal);
    const data = await response.json();
    const blocks = Array.isArray(data?.content) ? data.content : [];
    const text = blocks
      .filter((b: any) => b?.type === "text")
      .map((b: any) => String(b.text ?? ""))
      .join("");
    const toolCalls = blocks
      .filter((b: any) => b?.type === "tool_use")
      .map((b: any) => ({
        id: String(b.id ?? ""),
        name: String(b.name ?? ""),
        arguments: (b.input ?? {}) as Record<string, unknown>,
      }));
    const inputTokens = Number(data?.usage?.input_tokens ?? 0);
    const outputTokens = Number(data?.usage?.output_tokens ?? 0);
    const cacheReadInputTokens = Number(data?.usage?.cache_read_input_tokens ?? 0);
    const cacheCreationInputTokens = Number(data?.usage?.cache_creation_input_tokens ?? 0);
    const usage: Usage = {
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(modelId, inputTokens, outputTokens),
      modelId,
      cacheReadInputTokens,
      cacheCreationInputTokens,
    };
    return { text, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, usage };
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

    // Track tool_use blocks under construction (keyed by content_block index).
    const toolBlocks = new Map<number, { id: string; name: string; argsText: string; emitted: boolean }>();
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadInputTokens = 0;
    let cacheCreationInputTokens = 0;

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
          if (!payload) continue;
          let json: any;
          try { json = JSON.parse(payload); } catch { continue; }

          const t = json?.type;
          if (t === "message_start") {
            const u = json?.message?.usage;
            if (u) {
              inputTokens = Number(u.input_tokens ?? inputTokens);
              outputTokens = Number(u.output_tokens ?? outputTokens);
              cacheReadInputTokens = Number(u.cache_read_input_tokens ?? cacheReadInputTokens);
              cacheCreationInputTokens = Number(u.cache_creation_input_tokens ?? cacheCreationInputTokens);
            }
          } else if (t === "content_block_start") {
            const block = json?.content_block;
            if (block?.type === "tool_use") {
              toolBlocks.set(Number(json.index ?? 0), {
                id: String(block.id ?? ""),
                name: String(block.name ?? ""),
                argsText: "",
                emitted: false,
              });
            }
          } else if (t === "content_block_delta") {
            const d = json?.delta;
            if (d?.type === "text_delta" && typeof d.text === "string" && d.text.length > 0) {
              yield { type: "text_delta", delta: d.text };
            } else if (d?.type === "input_json_delta") {
              const tb = toolBlocks.get(Number(json.index ?? 0));
              if (tb && typeof d.partial_json === "string") tb.argsText += d.partial_json;
            }
          } else if (t === "content_block_stop") {
            const tb = toolBlocks.get(Number(json.index ?? 0));
            if (tb && !tb.emitted) {
              tb.emitted = true;
              yield {
                type: "tool_use_start",
                id: tb.id,
                name: tb.name,
                input: safeJsonParse(tb.argsText),
              };
            }
          } else if (t === "message_delta") {
            const u = json?.usage;
            if (u && typeof u.output_tokens === "number") outputTokens = u.output_tokens;
            if (u && typeof u.cache_read_input_tokens === "number") cacheReadInputTokens = u.cache_read_input_tokens;
            if (u && typeof u.cache_creation_input_tokens === "number") cacheCreationInputTokens = u.cache_creation_input_tokens;
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
      cacheCreationInputTokens,
    };
    yield { type: "done", usage };
  }
}

function safeJsonParse(s: string): unknown {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return { _raw: s }; }
}

function translateToolChoice(choice: ChatRequest["toolChoice"]): unknown {
  if (!choice || choice === "auto") return { type: "auto" };
  if (choice === "none") return { type: "none" } as unknown;
  if (choice === "required") return { type: "any" };
  if (typeof choice === "object" && choice.type === "function") {
    return { type: "tool", name: choice.name };
  }
  return { type: "auto" };
}