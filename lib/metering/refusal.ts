import "server-only";
import { getSupabase } from "@/lib/db/supabase";
import { getEnv } from "@/lib/env";
import { resolveChat } from "@/lib/llm/resolve";
import type { CallMeta, RetrievalTraceItem } from "@/lib/llm/types";

/**
 * Label a question's rows as refused (CLAUDE.md: a refusal costs only the
 * embedding). Rewrite rows keep their own status. Never throws.
 */
export async function markRefused(requestId: string, reason: string, trace?: RetrievalTraceItem[]): Promise<void> {
  const { error } = await getSupabase()
    .from("llm_calls")
    .update({ status: "refused", error_code: reason, ...(trace ? { trace } : {}) })
    .eq("request_id", requestId)
    .neq("use_case", "query-rewrite");
  if (error) console.error("markRefused failed:", error.message);
}

/** A refusal that happens before ANY model call (injection pre-check) still gets a $0 row, so it shows in the dashboard. */
export async function logPreModelRefusal(meta: CallMeta, reason: string): Promise<void> {
  try {
    const { env, providers } = getEnv();
    const m = resolveChat(env, providers.chat, "fast");
    const { error } = await getSupabase().from("llm_calls").insert({
      request_id: meta.requestId, provider: m.provider, model: m.pricingKey, deployment: m.deployment ?? null,
      operation: "chat", agency: meta.agency, use_case: meta.useCase, status: "refused", error_code: reason,
      cost_usd: 0, simulated: meta.simulated ?? false,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("logPreModelRefusal failed:", err instanceof Error ? err.message : err);
  }
}
