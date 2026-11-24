import { describe, expect, it } from "vitest";
import { ConfigError, envSchema, selectProviders } from "@/lib/env";

// Build an Env from a plain object, the same way getEnv() parses process.env.
const env = (vars: Record<string, string>) => envSchema.parse(vars);

const ANTHROPIC = { ANTHROPIC_API_KEY: "a", ANTHROPIC_MODEL_FAST: "fast", ANTHROPIC_MODEL_SMART: "smart" };
const OPENAI = { OPENAI_API_KEY: "o", OPENAI_CHAT_MODEL_FAST: "f", OPENAI_CHAT_MODEL_SMART: "s", OPENAI_EMBED_MODEL: "e" };
const AZURE = {
  AZURE_OPENAI_ENDPOINT: "https://x.openai.azure.com", AZURE_OPENAI_API_KEY: "z", AZURE_OPENAI_API_VERSION: "v",
  AZURE_CHAT_DEPLOYMENT_FAST: "f", AZURE_CHAT_DEPLOYMENT_SMART: "s", AZURE_EMBED_DEPLOYMENT: "e",
  AZURE_CHAT_FAST_PRICING_KEY: "azure:f", AZURE_CHAT_SMART_PRICING_KEY: "azure:s", AZURE_EMBED_PRICING_KEY: "azure:e",
};

describe("selectProviders", () => {
  it("auto prefers Azure for both when configured", () => {
    expect(selectProviders(env({ ...AZURE, ...OPENAI, ...ANTHROPIC }))).toEqual({ chat: "azure", embed: "azure" });
  });

  it("auto falls back to OpenAI, then Anthropic for chat", () => {
    expect(selectProviders(env({ ...OPENAI, ...ANTHROPIC })).chat).toBe("openai");
    expect(selectProviders(env({ ...ANTHROPIC, ...OPENAI, LLM_CHAT_PROVIDER: "anthropic" })).chat).toBe("anthropic");
  });

  it("supports Claude for chat and OpenAI for embeddings (the chosen setup)", () => {
    const e = env({ ...ANTHROPIC, ...OPENAI, LLM_CHAT_PROVIDER: "anthropic" });
    expect(selectProviders(e)).toEqual({ chat: "anthropic", embed: "openai" });
  });

  it("refuses to start with Anthropic only, because nothing can embed", () => {
    expect(() => selectProviders(env({ ...ANTHROPIC }))).toThrow(/embedding provider/i);
  });

  it("rejects LLM_EMBED_PROVIDER=anthropic", () => {
    expect(() => selectProviders(env({ ...ANTHROPIC, ...OPENAI, LLM_EMBED_PROVIDER: "anthropic" }))).toThrow(/no embeddings API/);
  });

  it("fails with nothing configured", () => {
    expect(() => selectProviders(env({}))).toThrow(ConfigError);
    expect(() => selectProviders(env({}))).toThrow(/No chat provider/);
  });

  it("lists every missing variable for a forced provider", () => {
    const e = env({ LLM_CHAT_PROVIDER: "azure", ...OPENAI });
    expect(() => selectProviders(e)).toThrow(/AZURE_OPENAI_ENDPOINT[\s\S]*AZURE_CHAT_DEPLOYMENT_FAST/);
  });

  it("forcing a provider overrides auto order", () => {
    const e = env({ ...AZURE, ...OPENAI, LLM_CHAT_PROVIDER: "openai", LLM_EMBED_PROVIDER: "openai" });
    expect(selectProviders(e)).toEqual({ chat: "openai", embed: "openai" });
  });

  it("treats empty strings as unset", () => {
    expect(() => selectProviders(env({ ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "" }))).toThrow(/No chat provider/);
  });
});
