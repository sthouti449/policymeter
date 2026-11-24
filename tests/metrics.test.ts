import { describe, expect, it } from "vitest";
import { computeBudgets, forecastMonthEnd } from "@/lib/metrics/budget";
import { callsToCsv, csvCell } from "@/lib/metrics/csv";
import { eachDay, toDailySeries } from "@/lib/metrics/daily";
import { parseFilters, rangeBounds } from "@/lib/metrics/filters";
import { agencyColor } from "@/lib/metrics/palette";
import { filtersToQuery, presetRange } from "@/lib/metrics/query-string";
import { shapeMetrics, zeroPriced } from "@/lib/metrics/shape";
import type { CallRow, ModelRow, PriceInfo } from "@/lib/metrics/types";
import { whatIf } from "@/lib/metrics/whatif";
import { formatCompact, formatCost } from "@/lib/format";

describe("forecast and budget status", () => {
  it("projects month-to-date spend over the whole month", () => {
    // Nov 11, 00:00 UTC = 10 days elapsed of 30: $1.00 so far -> $3.00
    expect(forecastMonthEnd(1, new Date("2026-11-11T00:00:00Z"))).toBeCloseTo(3, 10);
  });

  it("never counts less than one elapsed day, so day 1 can't project wildly", () => {
    expect(forecastMonthEnd(0.01, new Date("2026-11-01T01:00:00Z"))).toBeCloseTo(0.3, 10);
  });

  const cfg = {
    warning_threshold: 0.8, breach_threshold: 1,
    agencies: [{ code: "A", monthly_budget_usd: 3 }, { code: "B", monthly_budget_usd: 2 }, { code: "C", monthly_budget_usd: 2 }, { code: "D", monthly_budget_usd: 2 }],
  };
  const rows = computeBudgets([{ agency: "A", spend: 2.4 }, { agency: "B", spend: 2 }, { agency: "C", spend: 0.5 }], cfg, new Date("2026-11-15T00:00:00Z"));

  it("marks OK, Warning and Breached with the alert thresholds", () => {
    expect(rows.map((r) => r.status)).toEqual(["Warning", "Breached", "OK", "OK"]);
  });

  it("includes agencies with no spend", () => {
    expect(rows[3]).toMatchObject({ agency: "D", mtdSpendUsd: 0, pct: 0, forecastMonthEndUsd: 0 });
  });
});

describe("whatIf", () => {
  const model = (o: Partial<ModelRow>): ModelRow => ({ key: "m", calls: 1, costUsd: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, operation: "chat", ...o });
  const price = (o: Partial<PriceInfo>): PriceInfo => ({ key: "x", label: "X", input: 1, cachedInput: 0.1, output: 4, ...o });

  it("re-prices chat tokens on the target model and leaves embeddings alone", () => {
    const rows = [
      model({ key: "a", costUsd: 3, inputTokens: 1_000_000, outputTokens: 500_000 }),
      model({ key: "e", operation: "embed", costUsd: 0.02, inputTokens: 1_000_000 }),
    ];
    // 1M in * $1 + 0.5M out * $4 = $3 on the target, same as actual -> 0%
    const r = whatIf(rows, price({}));
    expect(r.whatIfUsd).toBeCloseTo(3, 10);
    expect(r.actualUsd).toBe(3);
    expect(r.embeddingUsd).toBe(0.02);
    expect(r.differencePct).toBeCloseTo(0, 8);
  });

  it("charges cached tokens at the cached price", () => {
    const r = whatIf([model({ costUsd: 1, inputTokens: 1_000_000, cachedInputTokens: 800_000, outputTokens: 0 })], price({}));
    expect(r.whatIfUsd).toBeCloseTo(0.2 + 0.08, 10);
  });

  it("reports a cheaper model as a negative difference", () => {
    const r = whatIf([model({ costUsd: 10, inputTokens: 1_000_000, outputTokens: 1_000_000 })], price({ input: 0.1, output: 0.5 }));
    expect(r.differencePct).toBeLessThan(-90);
  });

  it("has no percentage when there was no actual spend", () => {
    expect(whatIf([model({ costUsd: 0, inputTokens: 1000 })], price({})).differencePct).toBeNull();
  });
});

describe("daily series", () => {
  it("lists every day inclusive", () => {
    expect(eachDay("2026-11-28", "2026-12-02")).toEqual(["2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });

  it("zero-fills idle days and idle agencies so stacks keep a stable shape", () => {
    const s = toDailySeries([{ day: "2026-11-02", agency: "VITA", calls: 1, costUsd: 0.5 }, { day: "2026-11-02", agency: "VITA", calls: 1, costUsd: 0.25 }], "2026-11-01", "2026-11-03", ["VITA", "DMV"]);
    expect(s).toEqual([{ day: "2026-11-01", VITA: 0, DMV: 0 }, { day: "2026-11-02", VITA: 0.75, DMV: 0 }, { day: "2026-11-03", VITA: 0, DMV: 0 }]);
  });
});

describe("agency colours follow the agency", () => {
  it("uses the agencies.json position, so filtering never repaints", () => {
    const all = ["VITA", "DMV", "VDH"];
    expect(agencyColor("DMV", all)).toBe("var(--viz-series-2)");
    expect(agencyColor("DMV", all)).toBe(agencyColor("DMV", all)); // independent of what is shown
    expect(agencyColor("NOPE", all)).toBe("var(--viz-muted)");
  });
});

describe("CSV export", () => {
  const row: CallRow = {
    id: 1, requestId: "r1", createdAt: "2026-11-02T10:00:00Z", agency: "VITA", useCase: "policy-qa", model: "anthropic:claude-haiku-5-5", operation: "chat",
    inputTokens: 100, cachedInputTokens: 10, outputTokens: 20, costUsd: 0.0004, latencyMs: 900, ttftMs: 300, status: "ok", simulated: false, feedback: null,
  };

  it("escapes commas, quotes and newlines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it("defuses spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell(-5)).toBe("-5"); // real numbers stay numeric
  });

  it("writes a BOM, a header and one line per call with full-precision cost", () => {
    const csv = callsToCsv([row, { ...row, id: 2, costUsd: 0.5 }]);
    const lines = csv.replace("﻿", "").trimEnd().split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("date_utc,agency,use_case,model,operation,input_tokens,cached_input_tokens,output_tokens,cost_usd,status,simulated,request_id");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(",0.00040000,");
    expect(csv).not.toMatch(/question/i); // question text is never exported
  });
});

describe("filters", () => {
  const known = { agencies: ["VITA", "DMV"], useCases: ["policy-qa"] };
  const now = new Date("2026-11-23T12:00:00Z");
  const parse = (q: string) => parseFilters(new URLSearchParams(q), known, now);

  it("defaults to the last 30 days with simulated traffic ON", () => {
    expect(parse("")).toEqual({ ok: true, filters: { from: "2026-10-25", to: "2026-11-23", agency: undefined, useCase: undefined, model: undefined, includeSimulated: true } });
  });

  it("accepts valid filters and turns simulated off", () => {
    const r = parse("from=2026-11-01&to=2026-11-10&agency=DMV&useCase=policy-qa&includeSimulated=false");
    expect(r).toMatchObject({ ok: true, filters: { agency: "DMV", useCase: "policy-qa", includeSimulated: false } });
  });

  it.each([
    ["from=nope", /Dates must look like/],
    ["from=2026-11-10&to=2026-11-01", /on or before/],
    ["agency=NASA", /Unknown agency/],
    ["useCase=crypto", /Unknown use case/],
    ["from=2024-01-01&to=2026-11-01", /limited to/],
  ])("rejects %s", (q, msg) => {
    const r = parse(q);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });

  it("turns inclusive days into a half-open timestamp range", () => {
    expect(rangeBounds({ from: "2026-11-01", to: "2026-11-02" })).toEqual({ fromTs: "2026-11-01T00:00:00.000Z", toTs: "2026-11-03T00:00:00.000Z" });
  });

  it("round-trips through the query string and builds presets", () => {
    const f = { from: "2026-11-01", to: "2026-11-02", agency: "VITA", includeSimulated: false };
    expect(filtersToQuery(f, { page: 2 })).toBe("?from=2026-11-01&to=2026-11-02&includeSimulated=false&agency=VITA&page=2");
    expect(presetRange("7d", now)).toEqual({ from: "2026-11-17", to: "2026-11-23" });
    expect(presetRange("mtd", now)).toEqual({ from: "2026-11-01", to: "2026-11-23" });
  });
});

describe("shapeMetrics and zeroPriced", () => {
  it("maps the SQL JSON, tolerating nulls from an empty period", () => {
    const empty = shapeMetrics({ kpis: { spend_usd: 0, calls: 0, cost_per_answered_question: null, avg_answer_latency_ms: null }, by_agency: [] });
    expect(empty.kpis).toMatchObject({ spendUsd: 0, costPerAnsweredQuestion: null, avgAnswerLatencyMs: null, answeredQuestions: 0 });
    expect(empty.byAgency).toEqual([]);
    expect(empty.hasSimulated).toBe(false);
  });

  it("converts snake_case rows", () => {
    const s = shapeMetrics({
      kpis: { spend_usd: 1.5, calls: 3, answered_questions: 1, cost_per_answered_question: "0.5", avg_answer_latency_ms: 1200.4, input_tokens: 10, output_tokens: 5 },
      has_simulated: true,
      by_model: [{ key: "m", operation: "embed", calls: 2, cost_usd: 0.01, input_tokens: 9, cached_input_tokens: 0, output_tokens: 0 }],
      daily: [{ day: "2026-11-02", agency: "VITA", calls: 2, cost_usd: 0.4 }],
    });
    expect(s.kpis.costPerAnsweredQuestion).toBe(0.5);
    expect(s.byModel[0]).toMatchObject({ operation: "embed", costUsd: 0.01, cachedInputTokens: 0 });
    expect(s.daily[0]).toEqual({ day: "2026-11-02", agency: "VITA", calls: 2, costUsd: 0.4 });
    expect(s.hasSimulated).toBe(true);
  });

  it("flags zero or missing prices, but not an embedding model's missing output price", () => {
    const used = [
      { key: "chat0", operation: "chat" }, { key: "emb", operation: "embed" }, { key: "ok", operation: "chat" }, { key: "gone", operation: "chat" },
    ] as ModelRow[];
    const prices = { chat0: { input: 1, output: 0 }, emb: { input: 0.02, output: 0 }, ok: { input: 1, output: 2 } };
    expect(zeroPriced(used, prices)).toEqual(["chat0", "gone"]);
  });
});

describe("formatting", () => {
  it("shows 4 decimals under $1 and 2 above", () => {
    expect(formatCost(0.0004)).toBe("$0.0004");
    expect(formatCost(0.9999)).toBe("$0.9999");
    expect(formatCost(1)).toBe("$1.00");
    expect(formatCost(12.345)).toBe("$12.35");
    expect(formatCost(0)).toBe("$0.0000");
    expect(formatCost(0.0000012)).toBe("<$0.0001"); // tiny but real: never shown as free
  });

  it("compacts large counts", () => {
    expect([1284, 12_900, 340_000, 3_400_000].map(formatCompact)).toEqual(["1,284", "12.9K", "340K", "3.4M"]);
  });
});

describe("axis formatting", () => {
  it("trims tick labels but keeps small values readable", async () => {
    const { formatAxisCost } = await import("@/lib/format");
    expect([0, 0.04, 0.25, 0.0004, 0.0125, 1, 2.6].map(formatAxisCost)).toEqual(["$0", "$0.04", "$0.25", "$0.0004", "$0.0125", "$1.00", "$2.60"]);
  });
});
