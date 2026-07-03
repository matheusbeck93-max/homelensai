import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { AnthropicProvider } from "../anthropicProvider.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

Deno.test("complete() targets the Anthropic messages endpoint with correct headers", async () => {
  let capturedUrl = "";
  let capturedHeaders: Headers | null = null;
  let capturedBody: any;
  const fetchImpl: typeof fetch = async (url, init: any) => {
    capturedUrl = String(url);
    capturedHeaders = new Headers(init?.headers);
    capturedBody = JSON.parse((init?.body as string) ?? "{}");
    return jsonResponse({
      content: [{ type: "text", text: "hi there" }],
      usage: { input_tokens: 7, output_tokens: 3 },
    });
  };
  const provider = new AnthropicProvider({ apiKey: "sk-ant-test", fetchImpl });
  const result = await provider.complete("gateway:standard", {
    system: "be terse",
    messages: [{ role: "user", content: "hello" }],
    temperature: 0.2,
  });

  assertEquals(capturedUrl, "https://api.anthropic.com/v1/messages");
  assertEquals(capturedHeaders!.get("x-api-key"), "sk-ant-test");
  assertEquals(capturedHeaders!.get("anthropic-version"), "2023-06-01");
  assertEquals(capturedBody.model, "claude-sonnet-4-5");
  // Small system prompts (< ~4200 chars) MUST NOT carry cache_control — Anthropic
  // returns 400 when marking a block below the 1024-token ephemeral-cache floor.
  assertEquals(capturedBody.system, [{ type: "text", text: "be terse" }]);
  assertEquals(capturedBody.temperature, 0.2);
  assertEquals(capturedBody.messages[0], { role: "user", content: "hello" });

  assertEquals(result.text, "hi there");
  assertEquals(result.usage.inputTokens, 7);
  assertEquals(result.usage.outputTokens, 3);
  assertExists(result.usage.costUsd);
});

Deno.test("complete() translates OpenAI-shape tool messages into Anthropic blocks", async () => {
  let capturedBody: any;
  const fetchImpl: typeof fetch = async (_u, init: any) => {
    capturedBody = JSON.parse((init?.body as string) ?? "{}");
    return jsonResponse({
      content: [
        { type: "tool_use", id: "toolu_1", name: "lookup", input: { q: "a" } },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  };
  const provider = new AnthropicProvider({ apiKey: "x", fetchImpl });
  const result = await provider.complete("gateway:standard", {
    messages: [
      {
        role: "assistant",
        content: "",
        tool_calls: [
          { id: "toolu_0", type: "function", function: { name: "lookup", arguments: '{"q":"foo"}' } },
        ],
      },
      { role: "tool", tool_call_id: "toolu_0", content: "result text", name: "lookup" },
    ],
    tools: [{ name: "lookup", description: "x", parameters: { type: "object" } }],
  });

  // assistant tool_calls → assistant content[] with tool_use block
  assertEquals(capturedBody.messages[0].role, "assistant");
  assertEquals(capturedBody.messages[0].content[0].type, "tool_use");
  assertEquals(capturedBody.messages[0].content[0].name, "lookup");
  // tool role → user content[] with tool_result block
  assertEquals(capturedBody.messages[1].role, "user");
  assertEquals(capturedBody.messages[1].content[0].type, "tool_result");
  assertEquals(capturedBody.messages[1].content[0].tool_use_id, "toolu_0");
  // tools use input_schema, not parameters
  assertEquals(capturedBody.tools[0].input_schema.type, "object");

  assertEquals(result.toolCalls?.[0].name, "lookup");
  assertEquals(result.toolCalls?.[0].arguments, { q: "a" });
});

Deno.test("stream() parses SSE text deltas and emits done with usage", async () => {
  const sse = [
    `event: message_start\n`,
    `data: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 5, output_tokens: 0 } } })}\n\n`,
    `event: content_block_delta\n`,
    `data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } })}\n\n`,
    `data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo" } })}\n\n`,
    `data: ${JSON.stringify({ type: "message_delta", usage: { output_tokens: 2 } })}\n\n`,
  ].join("");
  const fetchImpl: typeof fetch = async () =>
    new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  const provider = new AnthropicProvider({ apiKey: "x", fetchImpl });
  const events: any[] = [];
  for await (const ev of provider.stream("gateway:standard", { messages: [{ role: "user", content: "hi" }] })) {
    events.push(ev);
  }
  const deltas = events.filter((e) => e.type === "text_delta").map((e) => e.delta).join("");
  assertEquals(deltas, "Hello");
  const done = events.at(-1);
  assertEquals(done.type, "done");
  assertEquals(done.usage.inputTokens, 5);
  assertEquals(done.usage.outputTokens, 2);
});

Deno.test("complete() surfaces 429 as retryable ProviderError", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("rate limited", { status: 429 });
  const provider = new AnthropicProvider({ apiKey: "x", fetchImpl });
  let thrown: any;
  try {
    await provider.complete("gateway:standard", { messages: [{ role: "user", content: "hi" }] });
  } catch (e) { thrown = e; }
  assertEquals(thrown?.status, 429);
  assertEquals(thrown?.retryable, true);
});

Deno.test("complete() attaches cache_control on system blocks >= 4200 chars", async () => {
  let capturedBody: any;
  const fetchImpl: typeof fetch = async (_u, init: any) => {
    capturedBody = JSON.parse((init?.body as string) ?? "{}");
    return jsonResponse({ content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1000, output_tokens: 1 } });
  };
  const provider = new AnthropicProvider({ apiKey: "x", fetchImpl });
  const bigSystem = "You are a helpful assistant. ".repeat(200); // ~5600 chars
  await provider.complete("gateway:standard", {
    system: bigSystem,
    messages: [{ role: "user", content: "hi" }],
  });
  assertEquals(capturedBody.system[0].cache_control, { type: "ephemeral" });
});

Deno.test("complete() emits systemDynamic as a second uncached system block", async () => {
  let capturedBody: any;
  const fetchImpl: typeof fetch = async (_u, init: any) => {
    capturedBody = JSON.parse((init?.body as string) ?? "{}");
    return jsonResponse({ content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 } });
  };
  const provider = new AnthropicProvider({ apiKey: "x", fetchImpl });
  const bigSystem = "STATIC ".repeat(1000); // > 4200 chars → cached
  await provider.complete("gateway:standard", {
    system: bigSystem,
    systemDynamic: "per-user preferences change every call",
    messages: [{ role: "user", content: "hi" }],
  });
  assertEquals(capturedBody.system.length, 2);
  assertEquals(capturedBody.system[0].cache_control, { type: "ephemeral" });
  assertEquals(capturedBody.system[1].text, "per-user preferences change every call");
  assertEquals(capturedBody.system[1].cache_control, undefined);
});