import "server-only";
import { getAgencies, getPricing } from "@/lib/config";
import { getSupabase } from "@/lib/db/supabase";
import { computeBudgets } from "./budget";
import { monthStartUtc, rangeBounds } from "./filters";
import { shapeMetrics, zeroPriced } from "./shape";
import type { AlertRow, CallRow, Filters, MetricsPayload, TraceChunk, TracePayload } from "./types";

const CALL_COLUMNS =
  "id,request_id,created_at,agency,use_case,model,operation,input_tokens,cached_input_tokens,output_tokens,cost_usd,latency_ms,ttft_ms,status,simulated,feedback";

type Db = Record<string, unknown>;
const toCall = (r: Db): CallRow => ({
  id: Number(r.id), requestId: String(r.request_id), createdAt: String(r.created_at), agency: String(r.agency), useCase: String(r.use_case),
  model: String(r.model), operation: r.operation === "embed" ? "embed" : "chat", inputTokens: Number(r.input_tokens),
  cachedInputTokens: Number(r.cached_input_tokens), outputTokens: Number(r.output_tokens), costUsd: Number(r.cost_usd),
  latencyMs: r.latency_ms == null ? null : Number(r.latency_ms), ttftMs: r.ttft_ms == null ? null : Number(r.ttft_ms),
  status: String(r.status), simulated: r.simulated === true, feedback: r.feedback == null ? null : Number(r.feedback),
});

/** Everything the dashboard shows, in three queries: aggregates, budgets, alerts. */
export async function getMetrics(f: Filters, now = new Date()): Promise<MetricsPayload> {
  const db = getSupabase();
  const { fromTs, toTs } = rangeBounds(f);
  const [agg, mtd, alerts] = await Promise.all([
    db.rpc("dashboard_metrics", { p_from: fromTs, p_to: toTs, p_agency: f.agency ?? null, p_use_case: f.useCase ?? null, p_model: f.model ?? null, p_include_simulated: f.includeSimulated }),
    db.rpc("budget_mtd", { p_since: monthStartUtc(now), p_include_simulated: f.includeSimulated }),
    (() => {
      const q = db.from("alerts").select("*").order("created_at", { ascending: false }).limit(20);
      return f.includeSimulated ? q : q.eq("simulated", false);
    })(),
  ]);
  for (const r of [agg, mtd, alerts]) if (r.error) throw new Error(r.error.message);

  const shaped = shapeMetrics(agg.data as Db);
  const pricing = getPricing().models;
  const chatModels = Object.entries(pricing)
    .filter(([, p]) => p.output > 0)
    .map(([key, p]) => ({ key, label: p.label, input: p.input, cachedInput: p.cached_input, output: p.output }));

  return {
    filters: f, ...shaped,
    budgets: computeBudgets((mtd.data as { agency: string; spend: number }[]) ?? [], getAgencies(), now),
    alerts: ((alerts.data as Db[]) ?? []).map((a): AlertRow => ({
      id: Number(a.id), createdAt: String(a.created_at), agency: String(a.agency), period: String(a.period), level: a.level as AlertRow["level"],
      spendUsd: Number(a.spend_usd), budgetUsd: Number(a.budget_usd), message: String(a.message), simulated: a.simulated === true,
    })),
    zeroPricedModels: zeroPriced(shaped.byModel, pricing),
    chatModels,
    modelLabels: Object.fromEntries(Object.entries(pricing).map(([k, p]) => [k, p.label])),
  };
}

function filteredCalls(f: Filters) {
  const { fromTs, toTs } = rangeBounds(f);
  let q = getSupabase().from("llm_calls").select(CALL_COLUMNS, { count: "exact" }).gte("created_at", fromTs).lt("created_at", toTs);
  if (f.agency) q = q.eq("agency", f.agency);
  if (f.useCase) q = q.eq("use_case", f.useCase);
  if (f.model) q = q.eq("model", f.model);
  if (!f.includeSimulated) q = q.eq("simulated", false);
  return q.order("created_at", { ascending: false }).order("id", { ascending: false });
}

export async function getCalls(f: Filters, page: number, pageSize: number): Promise<{ rows: CallRow[]; total: number }> {
  const { data, error, count } = await filteredCalls(f).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: ((data as unknown as Db[]) ?? []).map(toCall), total: count ?? 0 };
}

export const CSV_MAX_ROWS = 50_000;

/** All filtered calls for the chargeback export, fetched 1,000 at a time (the API's page limit). */
export async function getAllCalls(f: Filters): Promise<{ rows: CallRow[]; truncated: boolean }> {
  const rows: CallRow[] = [];
  for (let from = 0; from < CSV_MAX_ROWS; from += 1000) {
    const { data, error } = await filteredCalls(f).range(from, from + 999);
    if (error) throw new Error(error.message);
    const batch = ((data as unknown as Db[]) ?? []).map(toCall);
    rows.push(...batch);
    if (batch.length < 1000) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** One question's calls plus the chunks it retrieved (stored with the answer row). */
export async function getTrace(requestId: string): Promise<TracePayload | null> {
  const { data, error } = await getSupabase().from("llm_calls").select(`${CALL_COLUMNS},trace`).eq("request_id", requestId).order("id");
  if (error) throw new Error(error.message);
  if (!data?.length) return null;
  const raw = data as unknown as (Db & { trace: TraceChunk[] | null })[];
  const calls = raw.map(toCall);
  return {
    requestId, calls, totalCostUsd: calls.reduce((s, c) => s + c.costUsd, 0),
    retrieval: raw.find((r) => Array.isArray(r.trace))?.trace ?? [],
  };
}
