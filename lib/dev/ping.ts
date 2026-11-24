import "server-only";
import { getPrice } from "@/lib/config";
import { getSupabase } from "@/lib/db/supabase";
import { getEnv } from "@/lib/env";
import { guard } from "@/lib/guardrails/guard";
import { chat, embed } from "@/lib/llm";

// Shared by the temporary /dev/ping page and /api/dev/ping (removed in Stage 7).
// Goes through guard() like a real request, then reads back the llm_calls rows
// so you can check that what was logged matches what was returned.
export async function runPing(
  req: { headers: { get(name: string): string | null } },
  agency: string,
  useCase: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const question = "Reply with OK";
  const g = await guard(req, { question, agency, useCase }, { scope: agency === "DEMO" ? "demo" : "global" });
  if (!g.ok) return { status: g.status, body: { error: g.error } };

  const meta = { requestId: crypto.randomUUID(), agency, useCase, question };
  const body: Record<string, unknown> = { requestId: meta.requestId, providers: getEnv().providers };
  try {
    const res = await chat({ messages: [{ role: "user", content: question }], tier: "fast", maxTokens: 50, meta });
    body.chat = { text: res.text, model: res.model, latencyMs: res.latencyMs, usage: res.usage, price: getPrice(res.model) };
  } catch (e) {
    body.chat = { error: e instanceof Error ? e.message : String(e) };
  }
  try {
    const res = await embed(["ping"], { ...meta, useCase: "ingestion" });
    body.embed = { model: res.model, dims: res.vectors[0]?.length, usage: res.usage };
  } catch (e) {
    body.embed = { error: e instanceof Error ? e.message : String(e) };
  }

  const { data, error } = await getSupabase()
    .from("llm_calls")
    .select("operation,agency,use_case,model,input_tokens,cached_input_tokens,output_tokens,cost_usd,latency_ms,status,error_code")
    .eq("request_id", meta.requestId)
    .order("id");
  body.loggedRows = error ? { error: error.message } : data;
  return { status: 200, body };
}
