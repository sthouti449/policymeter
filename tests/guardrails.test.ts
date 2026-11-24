import { describe, expect, it } from "vitest";
import { makeInputSchema } from "@/lib/guardrails/input";
import { clientIp, hashIp } from "@/lib/guardrails/rateLimit";

const ok = { question: "What disclaimer is required?", agency: "DMV", useCase: "policy-qa" };

describe("input schema", () => {
  const schema = makeInputSchema(100);

  it("accepts a valid request and trims the question", () => {
    expect(schema.parse({ ...ok, question: "  hi  " }).question).toBe("hi");
  });

  it("rejects empty and over-long questions", () => {
    expect(schema.safeParse({ ...ok, question: "   " }).success).toBe(false);
    expect(schema.safeParse({ ...ok, question: "x".repeat(101) }).success).toBe(false);
  });

  it("rejects unknown agencies and use cases", () => {
    expect(schema.safeParse({ ...ok, agency: "NASA" }).success).toBe(false);
    expect(schema.safeParse({ ...ok, useCase: "crypto" }).success).toBe(false);
  });

  it("blocks internal use cases for public callers but not for admin code", () => {
    expect(schema.safeParse({ ...ok, useCase: "eval-run" }).success).toBe(false);
    expect(makeInputSchema(100, { allowInternal: true }).safeParse({ ...ok, useCase: "eval-run" }).success).toBe(true);
  });
});

describe("IP handling", () => {
  it("hashes deterministically and never contains the IP", () => {
    const h = hashIp("203.0.113.9", "salt");
    expect(h).toBe(hashIp("203.0.113.9", "salt"));
    expect(h).not.toContain("203");
    expect(h).toHaveLength(64);
  });

  it("changes with the salt or the IP", () => {
    expect(hashIp("1.1.1.1", "a")).not.toBe(hashIp("1.1.1.1", "b"));
    expect(hashIp("1.1.1.1", "a")).not.toBe(hashIp("1.1.1.2", "a"));
  });

  it("takes the first address in x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" });
    expect(clientIp(h)).toBe("198.51.100.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
