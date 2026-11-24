import { describe, expect, it } from "vitest";
import { getAgencies, getPrice, getPricing, zeroPricedKeys } from "@/lib/config";

describe("config", () => {
  it("loads and validates both config files", () => {
    expect(getPricing().currency).toBe("USD");
    expect(getAgencies().agencies.map((a) => a.code)).toContain("DEMO");
  });

  it("returns a price and defaults cache_write to a number", () => {
    const p = getPrice("anthropic:claude-haiku-5-5");
    expect(p.input).toBeGreaterThan(0);
    expect(typeof p.cache_write).toBe("number");
  });

  it("throws on an unknown pricing key instead of returning $0", () => {
    expect(() => getPrice("nope:model")).toThrow(/No price for/);
  });

  it("flags zero-priced chat models but not free embedding output", () => {
    const zero = zeroPricedKeys();
    expect(zero).toContain("azure:gpt-5.5");
    expect(zero).not.toContain("openai:text-embedding-3-small");
    expect(zero).not.toContain("anthropic:claude-haiku-5-5");
  });
});
