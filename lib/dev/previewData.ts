import "server-only";
import { getAgencies, getPricing } from "@/lib/config";
import { computeBudgets } from "@/lib/metrics/budget";
import { eachDay } from "@/lib/metrics/daily";
import type { CallRow, DailyRow, Filters, GroupRow, MetricsPayload, ModelRow, TracePayload } from "@/lib/metrics/types";

// TEMPORARY (removed in Stage 7): deterministic fake data so the dashboard can be
// previewed with no database. Nothing here touches Supabase or any model.

const WEIGHTS: Record<string, number> = { VITA: 30, DMV: 20, VDH: 15, VEC: 12, DSS: 13, VDOT: 10, DEMO: 6 };
const noise = (i: number) => 0.6 + 0.8 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);

export function previewMetrics(f: Filters): MetricsPayload {
  const cfg = getAgencies();
  const pricing = getPricing().models;
  const days = eachDay(f.from, f.to);
  const daily: DailyRow[] = days.flatMap((day, di) => {
    const weekend = [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());
    return cfg.agencies.map((a, ai) => ({ day, agency: a.code, calls: 6, costUsd: 0.012 * (WEIGHTS[a.code] ?? 5) / 10 * noise(di * 7 + ai) * (weekend ? 0.2 : 1) }));
  });

  const total = daily.reduce((s, r) => s + r.costUsd, 0);
  const sum = (key: (r: DailyRow) => string): GroupRow[] => {
    const m = new Map<string, GroupRow>();
    for (const r of daily) {
      const g = m.get(key(r)) ?? { key: key(r), calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };
      m.set(key(r), { ...g, calls: g.calls + r.calls, costUsd: g.costUsd + r.costUsd, inputTokens: g.inputTokens + r.calls * 1400, outputTokens: g.outputTokens + r.calls * 210 });
    }
    return [...m.values()].sort((a, b) => b.costUsd - a.costUsd);
  };
  const useCaseShare: [string, number][] = [["policy-qa", 0.5], ["registry-help", 0.14], ["procurement-check", 0.12], ["reviewer-assistant", 0.08], ["eval-run", 0.1], ["query-rewrite", 0.03], ["ingestion", 0.03]];
  const calls = daily.reduce((s, r) => s + r.calls, 0);
  const byModel: ModelRow[] = [
    { key: "anthropic:claude-haiku-5-5", operation: "chat", calls: Math.round(calls * 0.6), costUsd: total * 0.82, inputTokens: calls * 900, cachedInputTokens: calls * 120, outputTokens: calls * 130 },
    { key: "anthropic:claude-sonnet-5-5", operation: "chat", calls: Math.round(calls * 0.05), costUsd: total * 0.15, inputTokens: calls * 60, cachedInputTokens: 0, outputTokens: calls * 8 },
    { key: "openai:text-embedding-3-small", operation: "embed", calls: Math.round(calls * 0.35), costUsd: total * 0.03, inputTokens: calls * 250, cachedInputTokens: 0, outputTokens: 0 },
  ];
  const mtd = [2.1, 2.55, 3.2, 0.9, 1.7, 0.2, 0.1];
  const iso = new Date().toISOString();

  return {
    filters: f,
    kpis: { spendUsd: total, calls, answeredQuestions: Math.round(calls * 0.3), costPerAnsweredQuestion: 0.0021, avgAnswerLatencyMs: 1840, inputTokens: calls * 1400, outputTokens: calls * 210 },
    hasSimulated: true,
    byAgency: sum((r) => r.agency),
    byUseCase: useCaseShare.map(([key, share]) => ({ key, calls: Math.round(calls * share), costUsd: total * share, inputTokens: Math.round(calls * 1400 * share), outputTokens: Math.round(calls * 210 * share) })).sort((a, b) => b.costUsd - a.costUsd),
    byModel, daily,
    budgets: computeBudgets(cfg.agencies.map((a, i) => ({ agency: a.code, spend: mtd[i] ?? 0 })), cfg, new Date()),
    alerts: [
      { id: 3, createdAt: iso, agency: "VDH", period: iso.slice(0, 7), level: "breached", spendUsd: 3.2, budgetUsd: 3, message: "VDH has used 107% of its budget ($3.20 of $3.00): breached.", simulated: true },
      { id: 2, createdAt: iso, agency: "DMV", period: iso.slice(0, 7), level: "warning", spendUsd: 2.55, budgetUsd: 3, message: "DMV has used 85% of its budget ($2.55 of $3.00): warning.", simulated: true },
      { id: 1, createdAt: iso, agency: "GLOBAL", period: iso.slice(0, 10), level: "daily_cap", spendUsd: 2, budgetUsd: 2, message: "The global daily spend cap was reached: $2.0000 of $2.", simulated: false },
    ],
    zeroPricedModels: [],
    chatModels: Object.entries(pricing).filter(([, p]) => p.output > 0).map(([key, p]) => ({ key, label: p.label, input: p.input, cachedInput: p.cached_input, output: p.output })),
    modelLabels: Object.fromEntries(Object.entries(pricing).map(([k, p]) => [k, p.label])),
  };
}

const rid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

export function previewCalls(page: number, pageSize: number): { rows: CallRow[]; total: number } {
  const agencies = Object.keys(WEIGHTS);
  const rows = Array.from({ length: pageSize }, (_, i): CallRow => {
    const n = (page - 1) * pageSize + i;
    const embed = n % 3 === 0;
    return {
      id: 1000 - n, requestId: rid(Math.floor(n / 3)), createdAt: new Date(Date.now() - n * 3_600_000).toISOString(), agency: agencies[n % agencies.length],
      useCase: n % 7 === 0 ? "reviewer-assistant" : "policy-qa", model: embed ? "openai:text-embedding-3-small" : "anthropic:claude-haiku-5-5",
      operation: embed ? "embed" : "chat", inputTokens: embed ? 60 : 1200 + n * 9, cachedInputTokens: 0, outputTokens: embed ? 0 : 180 + n, costUsd: embed ? 0.0000012 : 0.00018 + n * 0.000002,
      latencyMs: embed ? 210 : 1500 + n * 11, ttftMs: embed ? null : 600, status: n % 11 === 0 ? "refused" : "ok", simulated: n % 2 === 0, feedback: null,
    };
  });
  return { rows, total: 120 };
}

export function previewTrace(requestId: string): TracePayload {
  const base = { requestId, createdAt: new Date().toISOString(), agency: "VITA", useCase: "policy-qa", cachedInputTokens: 0, status: "ok", simulated: false, feedback: null };
  const calls: CallRow[] = [
    { ...base, id: 1, model: "anthropic:claude-haiku-5-5", operation: "chat", useCase: "query-rewrite", inputTokens: 220, outputTokens: 24, costUsd: 0.000034, latencyMs: 420, ttftMs: null },
    { ...base, id: 2, model: "openai:text-embedding-3-small", operation: "embed", inputTokens: 18, outputTokens: 0, costUsd: 0.0000004, latencyMs: 190, ttftMs: null },
    { ...base, id: 3, model: "anthropic:claude-haiku-5-5", operation: "chat", inputTokens: 1840, outputTokens: 190, costUsd: 0.00028, latencyMs: 1650, ttftMs: 610 },
  ];
  return {
    requestId, calls, totalCostUsd: calls.reduce((s, c) => s + c.costUsd, 0),
    retrieval: [
      { chunkId: 11, docId: "eo22", title: "Executive Order 22 (2026)", page: 2, status: "current", similarity: 0.71, usedInPrompt: true },
      { chunkId: 12, docId: "eo30", title: "Executive Order 30 (2024)", page: 1, status: "rescinded", similarity: 0.66, usedInPrompt: true },
      { chunkId: 13, docId: "ea400", title: "AI Utilization Policy (EA400)", page: 7, status: "current", similarity: 0.24, usedInPrompt: false },
    ],
  };
}
