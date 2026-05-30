import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  completeWithFallback,
  pickModel,
  streamWithFallback,
} from "../router.ts";
import type { ModelId } from "../modelRegistry.ts";
import {
  type ChatProvider,
  type ChatRequest,
  type CompleteResult,
  ProviderError,
  type StreamEvent,
} from "../types.ts";

function fakeUsage(modelId: ModelId) {
  return { inputTokens: 1, outputTokens: 1, costUsd: 0, modelId };
}

Deno.test("pickModel resolves per-surface, per-tier", () => {
  const premium = pickModel("investor_chat", "premium");
  assertEquals(premium.primary, "gateway:premium");
  assertEquals(premium.fallback, "gateway:standard");

  const free = pickModel("preferences_assistant", "free");
  assertEquals(free.primary, "gateway:standard");
  assertEquals(free.fallback, "gateway:fallback");
});

Deno.test("completeWithFallback falls through on retryable error", async () => {
  const calls: ModelId[] = [];
  const provider: ChatProvider = {
    async complete(modelId: ModelId, _req: ChatRequest): Promise<CompleteResult> {
      calls.push(modelId);
      if (modelId === "gateway:standard") {
        throw new ProviderError("rate limited", 429, true);
      }
      return { text: "fallback ok", usage: fakeUsage(modelId) };
    },
    async *stream() { /* unused */ },
  };
  const result = await completeWithFallback(
    "preferences_assistant",
    { messages: [{ role: "user", content: "hi" }] },
    { userId: "u1", tier: "free" },
    { provider },
  );
  assertEquals(calls, ["gateway:standard", "gateway:fallback"]);
  assertEquals(result.text, "fallback ok");
});

Deno.test("completeWithFallback does NOT fall through on non-retryable error", async () => {
  const provider: ChatProvider = {
    async complete(): Promise<CompleteResult> {
      throw new ProviderError("credits exhausted", 402, false);
    },
    async *stream() { /* unused */ },
  };
  await assertRejects(
    () =>
      completeWithFallback(
        "preferences_assistant",
        { messages: [{ role: "user", content: "hi" }] },
        { userId: "u1", tier: "free" },
        { provider },
      ),
    ProviderError,
    "credits exhausted",
  );
});

Deno.test("streamWithFallback retries on retryable error before any output", async () => {
  const calls: ModelId[] = [];
  const provider: ChatProvider = {
    async complete() { return { text: "", usage: fakeUsage("gateway:standard") }; },
    async *stream(modelId: ModelId): AsyncIterable<StreamEvent> {
      calls.push(modelId);
      if (modelId === "gateway:premium") {
        yield { type: "error", message: "boom", retryable: true, status: 503 };
        return;
      }
      yield { type: "text_delta", delta: "ok" };
      yield { type: "done", usage: fakeUsage(modelId) };
    },
  };
  const events: StreamEvent[] = [];
  for await (const ev of streamWithFallback(
    "investor_chat",
    { messages: [{ role: "user", content: "hi" }] },
    { userId: "u1", tier: "premium" },
    { provider },
  )) {
    events.push(ev);
  }
  assertEquals(calls, ["gateway:premium", "gateway:standard"]);
  const texts = events.filter((e) => e.type === "text_delta").map((e) => (e as any).delta).join("");
  assertEquals(texts, "ok");
  assertEquals(events[events.length - 1].type, "done");
});

Deno.test("streamWithFallback does NOT retry on non-retryable error", async () => {
  const calls: ModelId[] = [];
  const provider: ChatProvider = {
    async complete() { return { text: "", usage: fakeUsage("gateway:standard") }; },
    async *stream(modelId: ModelId): AsyncIterable<StreamEvent> {
      calls.push(modelId);
      yield { type: "error", message: "no credits", retryable: false, status: 402 };
    },
  };
  const events: StreamEvent[] = [];
  for await (const ev of streamWithFallback(
    "investor_chat",
    { messages: [{ role: "user", content: "hi" }] },
    { userId: "u1", tier: "premium" },
    { provider },
  )) {
    events.push(ev);
  }
  assertEquals(calls, ["gateway:premium"]);
  assertEquals(events[0].type, "error");
  assertEquals((events[0] as any).retryable, false);
});