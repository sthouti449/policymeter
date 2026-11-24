import "server-only";
import { getSupabase } from "@/lib/db/supabase";
import type { ItemResult, ResultRow, RunRow, RunSummary } from "./types";

type Db = Record<string, unknown>;
const numOrNull = (v: unknown) => (v == null ? null : Number(v));

const toRun = (r: Db): RunRow => ({
  id: String(r.id), createdAt: String(r.created_at), provider: String(r.provider), model: String(r.model), questions: Number(r.questions),
  retrievalHitRate: numOrNull(r.retrieval_hit_rate), citationRate: numOrNull(r.citation_rate), groundednessAvg: numOrNull(r.groundedness_avg),
  refusalAccuracy: numOrNull(r.refusal_accuracy), p50LatencyMs: numOrNull(r.p50_latency_ms), p50TtftMs: numOrNull(r.p50_ttft_ms),
  totalCostUsd: numOrNull(r.total_cost_usd), answeredCostUsd: numOrNull(r.cost_per_answered_usd), notes: r.notes == null ? null : String(r.notes),
});

const toResult = (r: Db): ResultRow => ({
  id: Number(r.id), questionId: String(r.question_id), question: String(r.question), answer: String(r.answer ?? ""),
  expectedDocIds: (r.expected_doc_ids as string[]) ?? [], retrievedDocIds: (r.retrieved_doc_ids as string[]) ?? [],
  shouldRefuse: r.should_refuse === true, refused: r.refused === true, hit: r.hit == null ? null : r.hit === true,
  cited: r.cited == null ? null : r.cited === true, groundedness: numOrNull(r.groundedness), judgeReason: r.judge_reason == null ? null : String(r.judge_reason),
  misses: (r.misses as string[]) ?? [], ttftMs: null, latencyMs: Number(r.latency_ms ?? 0), costUsd: Number(r.cost_usd ?? 0), requestId: String(r.request_id ?? ""),
});

/** Save one run and its per-question results. Returns the run id. */
export async function saveRun(a: { provider: string; model: string; summary: RunSummary; items: ItemResult[]; notes: string }): Promise<string> {
  const db = getSupabase();
  const s = a.summary;
  const { data, error } = await db.from("eval_runs").insert({
    provider: a.provider, model: a.model, questions: s.questions, retrieval_hit_rate: s.retrievalHitRate, citation_rate: s.citationRate,
    groundedness_avg: s.groundednessAvg, refusal_accuracy: s.refusalAccuracy, p50_latency_ms: s.p50LatencyMs, p50_ttft_ms: s.p50TtftMs,
    total_cost_usd: s.totalCostUsd, cost_per_answered_usd: s.answeredCostUsd, notes: a.notes,
  }).select("id").single();
  if (error || !data) throw new Error(`saving eval run failed: ${error?.message}`);

  const rows = a.items.map((i) => ({
    run_id: data.id, question_id: i.questionId, question: i.question, answer: i.answer, expected_doc_ids: i.expectedDocIds,
    retrieved_doc_ids: i.retrievedDocIds, hit: i.hit, cited: i.cited, groundedness: i.groundedness, refused: i.refused,
    should_refuse: i.shouldRefuse, judge_reason: i.judgeReason, latency_ms: i.latencyMs, cost_usd: i.costUsd, misses: i.misses, request_id: i.requestId,
  }));
  const ins = await db.from("eval_results").insert(rows);
  if (ins.error) throw new Error(`saving eval results failed: ${ins.error.message}`);
  return String(data.id);
}

export async function listRuns(limit = 20): Promise<RunRow[]> {
  const { data, error } = await getSupabase().from("eval_runs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data as Db[]).map(toRun);
}

export async function getResults(runId: string): Promise<ResultRow[]> {
  const { data, error } = await getSupabase().from("eval_results").select("*").eq("run_id", runId).order("id");
  if (error) throw new Error(error.message);
  return (data as Db[]).map(toResult);
}
