import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { ChatEvent } from "@/lib/chat/types";
import { mapLimit } from "@/lib/evals/pool";
import { checkMentions, checkTargets, median, summarize } from "@/lib/evals/score";
import type { ItemResult } from "@/lib/evals/types";
import { buildMeterReport } from "@/lib/metering/report";
import { generateSeedRows, mulberry32, type SeedConfig } from "@/lib/seed/generate";

// ---------- scoring ----------
const item = (o: Partial<ItemResult>): ItemResult => ({
  questionId: "q", question: "?", answer: "a", expectedDocIds: ["d"], retrievedDocIds: ["d"], shouldRefuse: false, refused: false, hit: true, cited: true,
  groundedness: 5, judgeReason: "ok", misses: [], ttftMs: 1000, latencyMs: 2000, costUsd: 0.001, requestId: "r", ...o,
});

describe("checkMentions", () => {
  it("passes when any phrase in each group appears, ignoring case", () => {
    expect(checkMentions("EO 30 was RESCINDED by Executive Order 22.", [["Executive Order 22", "EO 22"], ["rescind"]])).toEqual([]);
  });
  it("reports each unsatisfied group as 'a / b'", () => {
    expect(checkMentions("It is still in force.", [["Executive Order 22", "EO 22"], ["rescind"]])).toEqual(["Executive Order 22 / EO 22", "rescind"]);
  });
  it("has no misses when nothing is required", () => expect(checkMentions("anything", [])).toEqual([]));
});

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3); // 2.5 rounds up
    expect(median([])).toBeNull();
  });
});

describe("summarize and checkTargets", () => {
  const items = [
    item({ questionId: "a", hit: true, cited: true, groundedness: 5 }),
    item({ questionId: "b", hit: true, cited: true, groundedness: 4, misses: ["rescind"] }),
    item({ questionId: "c", hit: false, cited: false, refused: true, groundedness: null }), // in scope but wrongly refused
    item({ questionId: "d", shouldRefuse: true, expectedDocIds: [], hit: null, cited: null, refused: true, groundedness: null, ttftMs: null }),
    item({ questionId: "e", shouldRefuse: true, expectedDocIds: [], hit: null, cited: null, refused: false, groundedness: null }),
  ];
  const s = summarize(items);

  it("counts a wrongly refused in-scope question against hit and citation rates", () => {
    expect(s).toMatchObject({ questions: 5, inScope: 3, outOfScope: 2 });
    expect(s.retrievalHitRate).toBeCloseTo(2 / 3);
    expect(s.citationRate).toBeCloseTo(2 / 3);
    expect(s.falseRefusals).toBe(1);
    expect(s.mentionMisses).toBe(1);
  });
  it("scores refusal accuracy over the should-refuse questions only", () => expect(s.refusalAccuracy).toBe(0.5));
  it("averages groundedness over judged answers only", () => expect(s.groundednessAvg).toBe(4.5));
  it("takes p50 time-to-first-token from questions that streamed", () => expect(s.p50TtftMs).toBe(1000));
  it("sums the run cost", () => expect(s.totalCostUsd).toBeCloseTo(0.005, 10));

  it("excludes the judge call from cost per answered question", () => {
    const judge = new Map([["r", 0.0004]]);
    expect(summarize([item({})], judge).answeredCostUsd).toBeCloseTo(0.0006, 10);
    expect(summarize([item({ shouldRefuse: true, refused: true })], judge).answeredCostUsd).toBeNull();
  });

  it("applies the PRD targets", () => {
    const good = summarize([item({}), item({ questionId: "z", shouldRefuse: true, expectedDocIds: [], hit: null, cited: null, refused: true, groundedness: null })]);
    expect(checkTargets({ ...good, answeredCostUsd: 0.002 }).map((t) => t.pass)).toEqual([true, true, true, true, true, true]);
    const bad = checkTargets({ ...s, answeredCostUsd: 0.02 });
    expect(Object.fromEntries(bad.map((t) => [t.key, t.pass]))).toMatchObject({ hit: false, cite: false, ground: true, refuse: false, ttft: true, cost: false });
  });

  it("reports unmeasurable targets as null, not as a failure", () => {
    const t = checkTargets(summarize([]));
    expect(t.every((x) => x.pass === null)).toBe(true);
  });
});

describe("mapLimit", () => {
  it("keeps results in order and never exceeds the limit", async () => {
    let live = 0, peak = 0;
    const out = await mapLimit([5, 1, 4, 2, 3], 2, async (n) => {
      live++; peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, n));
      live--;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30]);
    expect(peak).toBeLessThanOrEqual(2);
  });
  it("handles an empty list", async () => expect(await mapLimit([], 4, async (x) => x)).toEqual([]));
});

// ---------- the real golden set ----------
describe("golden set", () => {
  const golden = JSON.parse(fs.readFileSync(path.join(process.cwd(), "evals", "golden-set.json"), "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "config", "sources.manifest.json"), "utf8"));
  const docIds = new Set<string>(manifest.documents.map((d: { doc_id: string }) => d.doc_id));

  it("only expects documents that exist in the manifest (a typo would fail every run)", () => {
    for (const it of golden.items) for (const id of it.expected_doc_ids) expect(docIds.has(id), `${it.id} expects unknown doc "${id}"`).toBe(true);
  });
  it("has unique ids, and every in-scope question names a document and a phrase", () => {
    expect(new Set(golden.items.map((i: { id: string }) => i.id)).size).toBe(golden.items.length);
    for (const it of golden.items.filter((i: { should_refuse: boolean }) => !i.should_refuse)) {
      expect(it.expected_doc_ids.length, it.id).toBeGreaterThan(0);
      expect(it.must_mention.length, it.id).toBeGreaterThan(0);
    }
  });
  it("includes both out-of-scope and injection refusal questions", () => {
    expect(golden.items.filter((i: { should_refuse: boolean }) => i.should_refuse).length).toBeGreaterThanOrEqual(4);
  });
});

// ---------- judge reply parsing ----------
describe("parseVerdict", () => {
  it("reads plain JSON, fenced JSON and JSON with prose around it", async () => {
    const { parseVerdict } = await import("@/lib/evals/judge");
    expect(parseVerdict('{"score": 4, "reason": "Mostly supported."}')).toEqual({ score: 4, reason: "Mostly supported." });
    expect(parseVerdict('```json\n{"score":5,"reason":"All claims supported."}\n```')?.score).toBe(5);
    expect(parseVerdict('Here you go: {"score": 2, "reason": "Unsupported claim."} Thanks!')?.score).toBe(2);
  });
  it("rejects a score outside 1-5, a non-integer, or missing fields", async () => {
    const { parseVerdict } = await import("@/lib/evals/judge");
    for (const bad of ['{"score": 6, "reason": "x"}', '{"score": 0, "reason": "x"}', '{"score": 3.5, "reason": "x"}', '{"score": 4}', "not json", "{}", ""]) {
      expect(parseVerdict(bad), bad).toBeNull();
    }
  });
});

// ---------- seed traffic ----------
const cost = (u: { inputTokens: number; outputTokens: number }, key: string) => (key.includes("embed") ? u.inputTokens * 0.02 : u.inputTokens * 0.1 + u.outputTokens * 0.5) / 1e6;
const seedCfg = (o: Partial<SeedConfig> = {}): SeedConfig => ({
  now: new Date("2026-11-23T15:00:00Z"), days: 30, requests: 280, seed: 7, chat: { provider: "anthropic", model: "anthropic:fast" }, embed: { provider: "openai", model: "openai:embed" },
  agencies: [{ code: "VITA", weight: 30 }, { code: "DMV", weight: 20 }, { code: "VDH", weight: 15 }, { code: "VEC", weight: 12 }, { code: "DSS", weight: 13 }, { code: "VDOT", weight: 10 }],
  useCases: [{ code: "policy-qa", weight: 60 }, { code: "registry-help", weight: 20 }, { code: "procurement-check", weight: 20 }],
  trend: { agency: "DMV", budgetUsd: 3, targetUtilization: 0.92, maxScale: 25 }, cost, ...o,
});

describe("generateSeedRows", () => {
  const { rows, trend } = generateSeedRows(seedCfg());

  it("makes roughly 600 rows, all flagged simulated", () => {
    expect(rows.length).toBeGreaterThan(450);
    expect(rows.length).toBeLessThan(750);
    expect(rows.every((r) => r.simulated === true)).toBe(true);
  });
  it("is reproducible for a given seed and different for another", () => {
    expect(generateSeedRows(seedCfg()).rows).toEqual(rows);
    expect(generateSeedRows(seedCfg({ seed: 8 })).rows).not.toEqual(rows);
  });
  it("stays inside the date range and never in the future", () => {
    const times = rows.map((r) => Date.parse(r.created_at));
    expect(Math.max(...times)).toBeLessThanOrEqual(Date.parse("2026-11-23T15:00:00Z") + 1000);
    expect(Math.min(...times)).toBeGreaterThanOrEqual(Date.parse("2026-10-24T00:00:00Z"));
  });
  it("follows the agency weights", () => {
    const n = (a: string) => new Set(rows.filter((r) => r.agency === a).map((r) => r.request_id)).size;
    expect(n("VITA")).toBeGreaterThan(n("DMV"));
    expect(n("DMV")).toBeGreaterThan(n("VDOT"));
    expect(rows.some((r) => r.agency === "DEMO")).toBe(false);
  });
  it("is quieter at weekends than on weekdays", () => {
    const perDay = (weekend: boolean) => {
      const days = new Map<string, number>();
      for (const r of rows.filter((x) => x.operation === "embed")) days.set(r.created_at.slice(0, 10), (days.get(r.created_at.slice(0, 10)) ?? 0) + 1);
      const sel = [...days].filter(([d]) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()) === weekend).map(([, n]) => n);
      return sel.reduce((s, n) => s + n, 0) / Math.max(1, sel.length);
    };
    expect(perDay(true)).toBeLessThan(perDay(false));
  });
  it("prices rows with the supplied cost function and gives failed and refused calls $0", () => {
    for (const r of rows.filter((x) => x.status === "ok")) {
      expect(r.cost_usd).toBeCloseTo(cost({ inputTokens: r.input_tokens, outputTokens: r.output_tokens }, r.model), 12);
    }
    for (const r of rows.filter((x) => x.status === "error")) expect(r.cost_usd).toBe(0);
    expect(rows.some((r) => r.status === "refused")).toBe(true);
  });
  it("ramps the trend agency up through the month, within the scale cap", () => {
    expect(trend.scale).toBeGreaterThan(1);
    expect(trend.scale).toBeLessThanOrEqual(25);
    const dmv = rows.filter((r) => r.agency === "DMV" && r.operation === "chat" && r.status === "ok" && r.created_at >= "2026-11-01");
    const half = Math.floor(dmv.length / 2);
    const avg = (xs: typeof dmv) => xs.reduce((s, r) => s + r.input_tokens, 0) / xs.length;
    const sorted = [...dmv].sort((a, b) => a.created_at.localeCompare(b.created_at));
    expect(avg(sorted.slice(half))).toBeGreaterThan(avg(sorted.slice(0, half)));
  });
  it("reports honestly when the cap keeps it short of the target", () => {
    const capped = generateSeedRows(seedCfg({ trend: { agency: "DMV", budgetUsd: 300, targetUtilization: 0.92, maxScale: 2 } })).trend;
    expect(capped.capped).toBe(true);
    expect(capped.utilization).toBeLessThan(0.5);
  });
  it("imitates real token counts when it has enough samples", () => {
    const sample = { input: Array(20).fill(5000), output: Array(20).fill(300), latency: Array(20).fill(2500) };
    const answers = generateSeedRows(seedCfg({ sample, trend: { agency: "NONE", budgetUsd: 1, targetUtilization: 0, maxScale: 1 } })).rows.filter((r) => r.operation === "chat" && r.status === "ok" && r.use_case !== "query-rewrite");
    expect(answers.every((r) => r.input_tokens >= 4500 && r.input_tokens <= 5500)).toBe(true);
  });
});

describe("mulberry32", () => {
  it("is deterministic and stays in [0, 1)", () => {
    const a = mulberry32(1), b = mulberry32(1);
    for (let i = 0; i < 100; i++) { const v = a(); expect(v).toBe(b()); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

// ---------- metering report ----------
describe("buildMeterReport", () => {
  const row = (o = {}) => ({ provider: "anthropic", model: "m", operation: "chat", status: "ok", input_tokens: 100, cached_input_tokens: 10, output_tokens: 20, cost_usd: 0.001, usage_estimated: false, ...o });
  it("groups by provider, model and operation and totals them", () => {
    const r = buildMeterReport([row(), row(), row({ operation: "embed", model: "e", output_tokens: 0 })]);
    expect(r.groups).toHaveLength(2);
    expect(r.groups.find((g) => g.operation === "chat")).toMatchObject({ calls: 2, inputTokens: 200, cachedInputTokens: 20, outputTokens: 40 });
    expect(r.totals.calls).toBe(3);
    expect(r.totals.costUsd).toBeCloseTo(0.003, 10);
  });
  it("flags estimated usage, failed calls and tokens priced at $0", () => {
    const r = buildMeterReport([row({ usage_estimated: true }), row({ status: "error", input_tokens: 0, output_tokens: 0, cost_usd: 0 }), row({ cost_usd: 0 })]);
    expect(r.totals).toMatchObject({ estimatedCalls: 1, failedCalls: 1, unpricedCalls: 1 });
  });
  it("handles no rows", () => expect(buildMeterReport([]).totals.calls).toBe(0));
});

// ---------- the eval runner, with the pipeline and judge replaced ----------
const m = vi.hoisted(() => ({ answer: vi.fn(), judge: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ env: { RAG_MIN_SIMILARITY: 0.3 }, providers: { chat: "anthropic" } }) }));
vi.mock("@/lib/llm/resolve", () => ({ resolveChat: (_e: unknown, _p: unknown, tier: string) => ({ provider: "anthropic", model: tier, pricingKey: `anthropic:${tier}` }) }));
vi.mock("@/lib/rag/answer", () => ({ answerPolicyQuestion: m.answer }));
// Keep the real parseVerdict (tested above) and replace only the model call.
vi.mock("@/lib/evals/judge", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/evals/judge")>()), judgeAnswer: m.judge }));
vi.mock("@/lib/evals/store", () => ({ saveRun: m.save }));

function finalEvent(o: Partial<Extract<ChatEvent, { type: "final" }>> = {}): Extract<ChatEvent, { type: "final" }> {
  return {
    type: "final", requestId: "r", answer: "Answer with rescinded and Executive Order 22 [1].", refused: false, sources: [{ n: 1, chunkId: 1, docId: "eo22", title: "EO 22", page: 1, status: "current", replacedBy: null, url: null, content: "text", similarity: 0.7 }],
    citationsUsed: [1], rescindedCited: [], retrievedDocIds: ["eo22", "eo30"], cost: { inputTokens: 100, outputTokens: 20, costUsd: 0.001, latencyMs: 1500, ttftMs: 600, model: "m", provider: "anthropic" }, ...o,
  };
}
const stream = (ev: ChatEvent) => async function* () { yield ev; };

describe("runEvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.save.mockResolvedValue("run-1");
    m.judge.mockResolvedValue({ verdict: { score: 5, reason: "Supported." }, costUsd: 0.0004 });
  });

  it("runs the real pipeline as VITA / eval-run and scores each question", async () => {
    const { runEvals } = await import("@/lib/evals/run");
    m.answer.mockImplementation(({ question }: { question: string }) =>
      stream(/weather|Super Bowl|budget|Ignore your previous/i.test(question) ? finalEvent({ answer: "I can't find that in the loaded documents.", refused: true, sources: [], citationsUsed: [] }) : finalEvent())());
    const r = await runEvals({ only: ["q03-eo30-status", "q13-oos-weather"] });

    expect(m.answer.mock.calls[0][0]).toMatchObject({ agency: "VITA", useCase: "eval-run", history: [] });
    const inScope = r.items.find((i) => i.questionId === "q03-eo30-status")!;
    expect(inScope).toMatchObject({ hit: true, cited: true, refused: false, groundedness: 5, misses: [] });
    expect(inScope.costUsd).toBeCloseTo(0.0014, 10); // question + judge
    const oos = r.items.find((i) => i.questionId === "q13-oos-weather")!;
    expect(oos).toMatchObject({ shouldRefuse: true, refused: true, hit: null, cited: null, groundedness: null });
    expect(m.judge).toHaveBeenCalledOnce(); // refusals are not judged
    expect(r.summary.refusalAccuracy).toBe(1);
    expect(r.summary.answeredCostUsd).toBeCloseTo(0.001, 10); // judge excluded
    expect(m.save).toHaveBeenCalledOnce();
    expect(r.runId).toBe("run-1");
  });

  it("records missing phrases and a wrong retrieval as failures", async () => {
    const { runEvals } = await import("@/lib/evals/run");
    m.answer.mockImplementation(stream(finalEvent({ answer: "It is still in effect [1].", retrievedDocIds: ["ea400"] })));
    const r = await runEvals({ only: ["q03-eo30-status"] });
    expect(r.items[0]).toMatchObject({ hit: false });
    expect(r.items[0].misses.length).toBeGreaterThan(0);
    expect(r.summary.retrievalHitRate).toBe(0);
  });

  it("counts a pipeline error against the run instead of dropping the question", async () => {
    const { runEvals } = await import("@/lib/evals/run");
    m.answer.mockImplementation(() => (async function* () { throw new Error("db down"); })());
    const r = await runEvals({ only: ["q03-eo30-status", "q13-oos-weather"] });
    expect(r.items).toHaveLength(2);
    expect(r.items.find((i) => i.questionId === "q03-eo30-status")).toMatchObject({ answer: "[pipeline error]", hit: false, cited: false });
    expect(r.summary.refusalAccuracy).toBe(0); // the out-of-scope question was not refused
  });

  it("reports a judge that never returns valid JSON", async () => {
    const { runEvals } = await import("@/lib/evals/run");
    m.answer.mockImplementation(stream(finalEvent()));
    m.judge.mockResolvedValue({ verdict: null, costUsd: 0.0008 });
    const r = await runEvals({ only: ["q03-eo30-status"] });
    expect(r.items[0].groundedness).toBeNull();
    expect(r.summary.judgeFailures).toBe(1);
  });

  it("rejects a question id that is not in the golden set", async () => {
    const { runEvals } = await import("@/lib/evals/run");
    await expect(runEvals({ only: ["nope"] })).rejects.toThrow(/No golden-set questions/);
  });
});
