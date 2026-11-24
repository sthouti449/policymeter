import "server-only";
import { getSupabase } from "@/lib/db/supabase";
import { redactQuestion } from "@/lib/guardrails/redact";
import type { CallRecord } from "@/lib/llm/types";
import { checkBudget } from "./budget";
import { computeCost } from "./cost";

/**
 * Write one llm_calls row for a finished call (CLAUDE.md rule 2). Awaited by the
 * adapter, but it never throws: a logging failure must not break the answer.
 * Failed model calls are logged too, with status 'error' and zero cost.
 */
export async function logCall(rec: CallRecord): Promise<void> {
  let cost = 0;
  try {
    cost = computeCost(rec.usage, rec.model);
  } catch (err) {
    // Missing price: still record the call (with $0) rather than lose it.
    console.error("logCall: pricing lookup failed:", err instanceof Error ? err.message : err);
  }

  try {
    const { error } = await getSupabase().from("llm_calls").insert({
      request_id: rec.meta.requestId,
      provider: rec.provider,
      model: rec.model, // pricing key
      deployment: rec.deployment ?? null,
      operation: rec.operation,
      agency: rec.meta.agency,
      use_case: rec.meta.useCase,
      input_tokens: rec.usage.inputTokens,
      cached_input_tokens: rec.usage.cachedInputTokens,
      output_tokens: rec.usage.outputTokens,
      cost_usd: cost,
      latency_ms: rec.latencyMs,
      ttft_ms: rec.ttftMs,
      status: rec.status,
      error_code: rec.errorCode ?? null,
      usage_estimated: rec.usage.estimated,
      simulated: rec.meta.simulated ?? false,
      question_redacted: rec.meta.question ? redactQuestion(rec.meta.question) : null,
      top_similarity: rec.meta.topSimilarity ?? null,
      retrieved_chunk_ids: rec.meta.retrievedChunkIds ?? null,
      trace: rec.meta.trace ?? null,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("logCall: insert failed:", err instanceof Error ? err.message : err);
    return;
  }

  // Budget alerts are best effort too. Simulated rows are handled by the seed script.
  if (!rec.meta.simulated) {
    try {
      await checkBudget(rec.meta.agency);
    } catch (err) {
      console.error("checkBudget failed:", err instanceof Error ? err.message : err);
    }
  }
}
