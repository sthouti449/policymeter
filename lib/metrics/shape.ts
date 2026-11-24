import type { DailyRow, GroupRow, Kpis, ModelRow } from "./types";

// Turns the JSON from the dashboard_metrics SQL function (snake_case, values that
// may be null) into the camelCase shapes the dashboard uses. Pure, so it is tested
// with a fixture instead of a database.

type Raw = Record<string, unknown>;
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const rows = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);

const group = (r: Raw): GroupRow => ({
  key: String(r.key), calls: num(r.calls), costUsd: num(r.cost_usd), inputTokens: num(r.input_tokens), outputTokens: num(r.output_tokens),
});

export function shapeMetrics(raw: Raw) {
  const k = (raw.kpis ?? {}) as Raw;
  const kpis: Kpis = {
    spendUsd: num(k.spend_usd), calls: num(k.calls), answeredQuestions: num(k.answered_questions),
    costPerAnsweredQuestion: numOrNull(k.cost_per_answered_question), avgAnswerLatencyMs: numOrNull(k.avg_answer_latency_ms),
    inputTokens: num(k.input_tokens), outputTokens: num(k.output_tokens),
  };
  const byModel: ModelRow[] = rows(raw.by_model).map((r) => ({
    ...group(r), operation: r.operation === "embed" ? "embed" : "chat", cachedInputTokens: num(r.cached_input_tokens),
  }));
  const daily: DailyRow[] = rows(raw.daily).map((r) => ({ day: String(r.day), agency: String(r.agency), calls: num(r.calls), costUsd: num(r.cost_usd) }));
  return {
    kpis, byModel, daily,
    hasSimulated: raw.has_simulated === true,
    byAgency: rows(raw.by_agency).map(group),
    byUseCase: rows(raw.by_use_case).map(group),
  };
}

/**
 * Models used in this period whose price is missing or 0, so their cost is
 * understated. Embedding models legitimately have no output price.
 */
export function zeroPriced(
  used: ModelRow[],
  prices: Record<string, { input: number; output: number }>,
): string[] {
  const bad = new Set<string>();
  for (const r of used) {
    const p = prices[r.key];
    if (!p || p.input === 0 || (r.operation === "chat" && p.output === 0)) bad.add(r.key);
  }
  return [...bad].sort();
}
