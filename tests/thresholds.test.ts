import { describe, expect, it } from "vitest";
import { isCapReached, levelsCrossed } from "@/lib/metering/thresholds";

const levels = (spend: number, budget = 3) => levelsCrossed(spend, budget, 0.8, 1.0);

describe("levelsCrossed", () => {
  it("is empty below 80%", () => expect(levels(2.39)).toEqual([]));

  it("warns at exactly 80% (no floating-point miss)", () => {
    expect(levels(2.4)).toEqual(["warning"]);
  });

  it("stays at warning between 80% and 100%", () => expect(levels(2.99)).toEqual(["warning"]));

  it("breaches at exactly 100% and keeps the warning", () => {
    expect(levels(3)).toEqual(["warning", "breached"]);
  });

  it("reports both when one call jumps past 100%", () => expect(levels(10)).toEqual(["warning", "breached"]));

  it("works with tiny test budgets", () => {
    expect(levels(0.0001, 0.0001)).toEqual(["warning", "breached"]);
  });
});

describe("isCapReached", () => {
  it("is false below the cap and true at or above it", () => {
    expect(isCapReached(1.99, 2)).toBe(false);
    expect(isCapReached(2, 2)).toBe(true);
    expect(isCapReached(2.5, 2)).toBe(true);
  });

  it("blocks once any real spend exists under a near-zero cap", () => {
    expect(isCapReached(0, 0.000001)).toBe(false);
    expect(isCapReached(0.0002, 0.000001)).toBe(true);
  });
});
