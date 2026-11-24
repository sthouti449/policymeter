import { describe, expect, it } from "vitest";
import { MAX_STORED_QUESTION_CHARS, redact, redactQuestion } from "@/lib/guardrails/redact";

describe("redact", () => {
  it("removes emails", () => {
    expect(redact("write to jane.doe+x@agency.virginia.gov please")).toBe("write to [REDACTED] please");
  });

  it("removes SSN-like numbers, dashed and undashed", () => {
    expect(redact("SSN 123-45-6789 and 987654321")).toBe("SSN [REDACTED] and [REDACTED]");
  });

  it("removes US phone numbers in common formats", () => {
    for (const p of ["804-555-0142", "(804) 555-0142", "804.555.0142", "+1 804 555 0142", "8045550142"]) {
      expect(redact(`call ${p} now`)).toBe("call [REDACTED] now");
    }
  });

  it("leaves ordinary policy text alone", () => {
    const q = "Is Executive Order 30 still in effect after September 18, 2026?";
    expect(redact(q)).toBe(q);
  });

  it("truncates to 500 characters after redacting", () => {
    const out = redactQuestion("a".repeat(900));
    expect(out).toHaveLength(MAX_STORED_QUESTION_CHARS);
  });

  it("redacts before cutting, so a pattern can't leak through the cut", () => {
    const text = "x".repeat(495) + " 123-45-6789";
    expect(redactQuestion(text)).not.toMatch(/\d{3}-\d{2}/);
  });
});
