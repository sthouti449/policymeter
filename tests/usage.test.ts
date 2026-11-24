import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { makeOpenAICompat } from "@/lib/llm/openai-compat";
import { estimateUsage, fromAnthropic, fromOpenAI } from "@/lib/llm/usage";

// Fixture payloads copied from the shape of real provider responses (no network).

describe("fromOpenAI (OpenAI and Azure)", () => {
  it("keeps prompt_tokens as the total and reads cached tokens", () => {
    const u = fromOpenAI({
      prompt_tokens: 1240, completion_tokens: 210,
      prompt_tokens_details: { cached_tokens: 1024 },
    });
    expect(u).toEqual({ inputTokens: 1240, cachedInputTokens: 1024, cacheWriteTokens: 0, outputTokens: 210, estimated: false });
  });

  it("handles a response with no cache details", () => {
    expect(fromOpenAI({ prompt_tokens: 50, completion_tokens: 5 })?.cachedInputTokens).toBe(0);
  });

  it("returns null when the provider sent no usage", () => {
    expect(fromOpenAI(undefined)).toBeNull();
    expect(fromOpenAI(null)).toBeNull();
  });
});

describe("fromAnthropic", () => {
  it("adds cache reads and writes back into the total input", () => {
    // Anthropic's input_tokens excludes cached tokens: 20 fresh + 900 read + 100 written.
    const u = fromAnthropic({ input_tokens: 20, output_tokens: 180, cache_read_input_tokens: 900, cache_creation_input_tokens: 100 });
    expect(u).toEqual({ inputTokens: 1020, cachedInputTokens: 900, cacheWriteTokens: 100, outputTokens: 180, estimated: false });
  });

  it("treats null cache fields as zero", () => {
    const u = fromAnthropic({ input_tokens: 300, output_tokens: 40, cache_read_input_tokens: null, cache_creation_input_tokens: null });
    expect(u).toMatchObject({ inputTokens: 300, cachedInputTokens: 0, cacheWriteTokens: 0 });
  });

  it("returns null with no usage", () => {
    expect(fromAnthropic(undefined)).toBeNull();
  });
});

describe("estimateUsage", () => {
  it("uses chars/4 and flags the result as estimated", () => {
    expect(estimateUsage("a".repeat(400), "b".repeat(40))).toMatchObject({ inputTokens: 100, outputTokens: 10, estimated: true });
  });
});

// A fake OpenAI client that replays recorded streaming chunks.
const fakeClient = (chunks: unknown[]) =>
  ({
    chat: { completions: { create: async (p: { stream?: boolean }) => {
      if (!p.stream) return { choices: [{ message: { content: "OK" } }], usage: { prompt_tokens: 12, completion_tokens: 2 } };
      return (async function* () { for (const c of chunks) yield c; })();
    } } },
    embeddings: { create: async () => ({ data: [{ embedding: [0.1, 0.2] }], usage: { prompt_tokens: 7, total_tokens: 7 } }) },
  }) as never;

describe("OpenAI-compatible adapter", () => {
  beforeEach(() => {
    Object.assign(process.env, { OPENAI_API_KEY: "k", OPENAI_CHAT_MODEL_FAST: "f", OPENAI_CHAT_MODEL_SMART: "s", OPENAI_EMBED_MODEL: "e" });
    resetEnvCache();
  });
  afterEach(() => {
    for (const k of ["OPENAI_API_KEY", "OPENAI_CHAT_MODEL_FAST", "OPENAI_CHAT_MODEL_SMART", "OPENAI_EMBED_MODEL"]) delete process.env[k];
    resetEnvCache();
  });

  const model = { provider: "openai" as const, model: "f", pricingKey: "openai:f" };
  const messages = [{ role: "user" as const, content: "hi" }];

  it("reads streaming usage from the final chunk", async () => {
    const impl = makeOpenAICompat(fakeClient([
      { choices: [{ delta: { content: "O" } }] },
      { choices: [{ delta: { content: "K" } }] },
      { choices: [], usage: { prompt_tokens: 30, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 10 } } },
    ]));
    const events = [];
    for await (const e of impl.stream({ messages, model, maxTokens: 10 })) events.push(e);
    expect(events.filter((e) => "delta" in e)).toHaveLength(2);
    expect(events.at(-1)).toEqual({ usage: { inputTokens: 30, cachedInputTokens: 10, cacheWriteTokens: 0, outputTokens: 2, estimated: false } });
  });

  it("falls back to an estimate when a stream never reports usage", async () => {
    const impl = makeOpenAICompat(fakeClient([{ choices: [{ delta: { content: "OK" } }] }]));
    const events = [];
    for await (const e of impl.stream({ messages, model, maxTokens: 10 })) events.push(e);
    expect((events.at(-1) as { usage: { estimated: boolean } }).usage.estimated).toBe(true);
  });

  it("normalises chat and embedding usage", async () => {
    const impl = makeOpenAICompat(fakeClient([]));
    expect((await impl.chat({ messages, model, maxTokens: 10 })).usage.inputTokens).toBe(12);
    const emb = await impl.embed({ texts: ["x"], model });
    expect(emb.vectors).toEqual([[0.1, 0.2]]);
    expect(emb.usage).toMatchObject({ inputTokens: 7, outputTokens: 0 });
  });
});
