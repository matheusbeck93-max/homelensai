import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { LovableGatewayProvider } from "../lovableGatewayProvider.ts";
import type { StreamEvent } from "../types.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(events: string[]): Response {
  const body = events.map((e) => `data: ${e}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

Deno.test("complete() returns text + usage and forwards reasoning_effort", async () => {
  let capturedBody: any;
  const fetchImpl: typeof fetch = async (_url, init: any) => {
    capturedBody = JSON.parse((init?.body as string) ?? "{}");
    return jsonResponse({
      choices: [{ message: { content: "Hello world" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
  };
  const provider = new LovableGatewayProvider({ apiKey: "test", fetchImpl });
  const result = await provider.complete("gateway:standard", {
    messages: [{ role: "user", content: "hi" }],
  });
  assertEquals(result.text, "Hello world");
  assertEquals(result.usage.inputTokens, 10);
  assertEquals(result.usage.outputTokens, 5);
  // After the Sonnet-everywhere migration the registry resolves every
  // ModelId to the Anthropic Sonnet apiName with no reasoning_effort.
  assertEquals(capturedBody.model, "claude-sonnet-4-5");
  assertEquals(capturedBody.reasoning_effort, undefined);
});

Deno.test("complete() premium tier resolves to Sonnet with no reasoning_effort", async () => {
  let capturedBody: any;
  const fetchImpl: typeof fetch = async (_url, init: any) => {
    capturedBody = JSON.parse((init?.body as string) ?? "{}");
    return jsonResponse({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
  };
  const provider = new LovableGatewayProvider({ apiKey: "test", fetchImpl });
  await provider.complete("gateway:premium", { messages: [{ role: "user", content: "hi" }] });
  assertEquals(capturedBody.model, "claude-sonnet-4-5");
  assertEquals(capturedBody.reasoning_effort, undefined);
});

Deno.test("complete() omits reasoning_effort for fallback model", async () => {
  let capturedBody: any;
  const fetchImpl: typeof fetch = async (_url, init: any) => {
    capturedBody = JSON.parse((init?.body as string) ?? "{}");
    return jsonResponse({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
  };
  const provider = new LovableGatewayProvider({ apiKey: "test", fetchImpl });
  await provider.complete("gateway:fallback", { messages: [{ role: "user", content: "hi" }] });
  assertEquals(capturedBody.model, "claude-sonnet-4-5");
  assertEquals(capturedBody.reasoning_effort, undefined);
});

Deno.test("stream() parses text_delta events and emits done with usage", async () => {
  const fetchImpl: typeof fetch = async () =>
    sseResponse([
      JSON.stringify({ choices: [{ delta: { content: "Hel" } }] }),
      JSON.stringify({ choices: [{ delta: { content: "lo" } }] }),
      JSON.stringify({ usage: { prompt_tokens: 3, completion_tokens: 2 }, choices: [{ delta: {}, finish_reason: "stop" }] }),
    ]);
  const provider = new LovableGatewayProvider({ apiKey: "test", fetchImpl });
  const events: StreamEvent[] = [];
  for await (const ev of provider.stream("gateway:standard", { messages: [{ role: "user", content: "hi" }] })) {
    events.push(ev);
  }
  const texts = events.filter((e) => e.type === "text_delta").map((e) => (e as any).delta).join("");
  assertEquals(texts, "Hello");
  const done = events.find((e) => e.type === "done") as any;
  assertEquals(done.usage.inputTokens, 3);
  assertEquals(done.usage.outputTokens, 2);
});

Deno.test("stream() reassembles tool_calls into tool_use_start", async () => {
  const fetchImpl: typeof fetch = async () =>
    sseResponse([
      JSON.stringify({
        choices: [{
          delta: {
            tool_calls: [{ index: 0, id: "call_1", function: { name: "lookup", arguments: '{"q":"' } }],
          },
        }],
      }),
      JSON.stringify({
        choices: [{
          delta: { tool_calls: [{ index: 0, function: { arguments: 'foo"}' } }] },
        }],
      }),
      JSON.stringify({
        choices: [{ delta: {}, finish_reason: "tool_calls" }],
        usage: { prompt_tokens: 5, completion_tokens: 3 },
      }),
    ]);
  const provider = new LovableGatewayProvider({ apiKey: "test", fetchImpl });
  const events: StreamEvent[] = [];
  for await (const ev of provider.stream("gateway:standard", { messages: [{ role: "user", content: "hi" }] })) {
    events.push(ev);
  }
  const toolStart = events.find((e) => e.type === "tool_use_start") as any;
  assertEquals(toolStart.id, "call_1");
  assertEquals(toolStart.name, "lookup");
  assertEquals((toolStart.input as any).q, "foo");
});

Deno.test("stream() yields retryable error on 429", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("rate limited", { status: 429 });
  const provider = new LovableGatewayProvider({ apiKey: "test", fetchImpl });
  const events: StreamEvent[] = [];
  for await (const ev of provider.stream("gateway:standard", { messages: [{ role: "user", content: "hi" }] })) {
    events.push(ev);
  }
  assertEquals(events.length, 1);
  assertEquals(events[0].type, "error");
  assertEquals((events[0] as any).retryable, true);
  assertEquals((events[0] as any).status, 429);
});

Deno.test("stream() yields non-retryable error on 402", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("payment required", { status: 402 });
  const provider = new LovableGatewayProvider({ apiKey: "test", fetchImpl });
  const events: StreamEvent[] = [];
  for await (const ev of provider.stream("gateway:standard", { messages: [{ role: "user", content: "hi" }] })) {
    events.push(ev);
  }
  assertEquals(events[0].type, "error");
  assertEquals((events[0] as any).retryable, false);
  assertEquals((events[0] as any).status, 402);
});