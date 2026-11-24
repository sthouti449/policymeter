import type { ItemResult, RunSummary, TargetResult } from "./types";

/**
 * must_mention is a list of groups. A group is satisfied when ANY of its phrases
 * appears (case-insensitive). Returns the groups that were not satisfied, each
 * written as "phrase A / phrase B".
 */
export function checkMentions(answer: string, groups: string[][]): string[] {
  const text = answer.toLowerCase();
  return groups.filter((g) => !g.some((p) => text.includes(p.toLowerCase()))).map((g) => g.join(" / "));
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}

const rate = (n: number, d: number) => (d ? n / d : null);

/** Turn per-question results into the run's headline numbers. */
export function summarize(items: ItemResult[], judgeCosts: Map<string, number> = new Map()): RunSummary {
  const inScope = items.filter((i) => !i.shouldRefuse);
  const outOfScope = items.filter((i) => i.shouldRefuse);
  const judged = items.filter((i) => i.groundedness != null);
  return {
    questions: items.length,
    inScope: inScope.length,
    outOfScope: outOfScope.length,
    // Misses count against us: a refused in-scope question has hit = false.
    retrievalHitRate: rate(inScope.filter((i) => i.hit).length, inScope.length),
    citationRate: rate(inScope.filter((i) => i.cited).length, inScope.length),
    groundednessAvg: judged.length ? judged.reduce((s, i) => s + (i.groundedness ?? 0), 0) / judged.length : null,
    refusalAccuracy: rate(outOfScope.filter((i) => i.refused).length, outOfScope.length),
    falseRefusals: inScope.filter((i) => i.refused).length,
    mentionMisses: inScope.filter((i) => i.misses.length > 0).length,
    judgeFailures: inScope.filter((i) => !i.refused && i.groundedness == null).length,
    p50TtftMs: median(items.flatMap((i) => (i.ttftMs != null ? [i.ttftMs] : []))),
    p50LatencyMs: median(items.map((i) => i.latencyMs)),
    totalCostUsd: items.reduce((s, i) => s + i.costUsd, 0),
    answeredCostUsd: answeredCost(items, judgeCosts),
  };
}

const pct = (v: number | null) => (v == null ? "n/a" : `${(v * 100).toFixed(0)}%`);

/** The PRD's adopt bar (docs/PRD.md section 4), checked against one run. */
export function checkTargets(s: RunSummary): TargetResult[] {
  const answeredCostPerQuestion = s.answeredCostUsd;
  const t = (key: string, label: string, target: string, value: string, pass: boolean | null): TargetResult => ({ key, label, target, value, pass });
  return [
    t("hit", "Retrieval hit rate", ">= 85%", pct(s.retrievalHitRate), s.retrievalHitRate == null ? null : s.retrievalHitRate >= 0.85),
    t("cite", "Answers with a valid citation", ">= 95%", pct(s.citationRate), s.citationRate == null ? null : s.citationRate >= 0.95),
    t("ground", "Groundedness (judge, 1-5)", ">= 4.2", s.groundednessAvg == null ? "n/a" : s.groundednessAvg.toFixed(2), s.groundednessAvg == null ? null : s.groundednessAvg >= 4.2),
    t("refuse", "Correct refusals", "100%", pct(s.refusalAccuracy), s.refusalAccuracy == null ? null : s.refusalAccuracy >= 1),
    t("ttft", "p50 time to first token", "<= 4 s", s.p50TtftMs == null ? "n/a" : `${(s.p50TtftMs / 1000).toFixed(1)} s`, s.p50TtftMs == null ? null : s.p50TtftMs <= 4000),
    t("cost", "Cost per answered question", "< $0.01", answeredCostPerQuestion == null ? "n/a" : `$${answeredCostPerQuestion.toFixed(4)}`, answeredCostPerQuestion == null ? null : answeredCostPerQuestion < 0.01),
  ];
}

/** Mean cost of the questions the assistant actually answered (not refused), judge call excluded. */
export function answeredCost(items: ItemResult[], judgeCostById: Map<string, number>): number | null {
  const answered = items.filter((i) => !i.shouldRefuse && !i.refused);
  if (!answered.length) return null;
  return answered.reduce((s, i) => s + i.costUsd - (judgeCostById.get(i.requestId) ?? 0), 0) / answered.length;
}
