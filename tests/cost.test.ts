import { describe, expect, it, vi } from "vitest";
import { computeCost } from "@/lib/metering/cost";
import type { Usage } from "@/lib/llm/types";

// Fixed prices so these tests don't change when pricing.json is updated.
vi.mock("@/lib/config", () => ({
  getPrice: (key: string) => {
    const prices: Record<string, object> = {
      chat: { input: 1, cached_input: 0.1, cache_write: 1.25, output: 4, label: "chat" },
      embed: { input: 0.02, cached_input: 0, cache_write: 0, output: 0, label: "embed" },
    };
    if (!prices[key]) throw new Error(`No price for "${key}"`);
    return prices[key];
  },
}));

const usage = (u: Partial<Usage>): Usage => ({ inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, estimated: false, ...u });

describe("computeCost", () => {
  it("prices input and output with no cached tokens", () => {
    // 1,000,000 in * $1 + 500,000 out * $4 = $3
    expect(computeCost(usage({ inputTokens: 1_000_000, outputTokens: 500_000 }), "chat")).toBeCloseTo(3, 10);
  });

  it("charges cached tokens at the cached price and only the rest at full price", () => {
    // 200k fresh * $1 + 800k cached * $0.10 + 100k out * $4 = 0.2 + 0.08 + 0.4
    expect(computeCost(usage({ inputTokens: 1_000_000, cachedInputTokens: 800_000, outputTokens: 100_000 }), "chat")).toBeCloseTo(0.68, 10);
  });

  it("charges cache writes at the cache-write price", () => {
    // 100k fresh + 100k written (at 1.25) = 0.1 + 0.125
    expect(computeCost(usage({ inputTokens: 200_000, cacheWriteTokens: 100_000 }), "chat")).toBeCloseTo(0.225, 10);
  });

  it("prices embeddings on input tokens only", () => {
    expect(computeCost(usage({ inputTokens: 2_000_000 }), "embed")).toBeCloseTo(0.04, 10);
  });

  it("is zero for a failed call with no usage", () => {
    expect(computeCost(usage({}), "chat")).toBe(0);
  });

  it("never goes negative if cached tokens exceed the input total", () => {
    expect(computeCost(usage({ inputTokens: 10, cachedInputTokens: 50 }), "chat")).toBeGreaterThanOrEqual(0);
  });

  it("throws on an unknown pricing key", () => {
    expect(() => computeCost(usage({ inputTokens: 1 }), "nope")).toThrow(/No price/);
  });
});
