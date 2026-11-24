import "server-only";
import { getPrice } from "@/lib/config";
import { getEnv } from "@/lib/env";
import { looksLikeInjection } from "@/lib/guardrails/injection";
import { chat } from "@/lib/llm";
import { resolveChat } from "@/lib/llm/resolve";
import { computeCost } from "@/lib/metering/cost";
import { logPreModelRefusal, markRefused } from "@/lib/metering/refusal";
import { DEMO_OFF_TOPIC, type DemoReply } from "@/lib/chat/demo";
import type { CostInfo } from "@/lib/chat/types";
import { buildDemoContext, DEMO_SYSTEM_PROMPT, isDemoRefusal } from "./prompt";
import { retrieve } from "./retrieve";

const label = (key: string) => {
  try { return getPrice(key).label; } catch { return key; }
};

/**
 * The "Ask about this demo" pipeline (runs after guard()): injection check ->
 * retrieve from the 'about' corpus -> threshold -> one non-streamed answer
 * (fast tier, 300 tokens). Always metered as agency DEMO, use case reviewer-assistant.
 */
export async function answerDemoQuestion(question: string, requestId = crypto.randomUUID()): Promise<DemoReply> {
  const { env, providers } = getEnv();
  const meta = { requestId, agency: "DEMO", useCase: "reviewer-assistant", question };
  const started = performance.now();
  const fast = resolveChat(env, providers.chat, "fast");

  const refuse = (costUsd: number): DemoReply => ({
    answer: DEMO_OFF_TOPIC, refused: true, sources: [],
    cost: { inputTokens: 0, outputTokens: 0, costUsd, latencyMs: Math.round(performance.now() - started), ttftMs: null, model: label(fast.pricingKey), provider: fast.provider },
  });

  if (looksLikeInjection(question)) {
    await logPreModelRefusal(meta, "injection");
    return refuse(0);
  }

  const found = await retrieve(question, "about", meta);
  const usable = found.chunks.filter((c) => c.similarity >= env.RAG_MIN_SIMILARITY);
  if (!usable.length) {
    await markRefused(requestId, "low_similarity");
    return refuse(found.embedCostUsd);
  }

  const res = await chat({
    messages: [
      { role: "system", content: DEMO_SYSTEM_PROMPT },
      { role: "user", content: `<context>\n${buildDemoContext(usable)}\n</context>\n\nQuestion: ${question}` },
    ],
    tier: "fast",
    maxTokens: 300,
    meta: { ...meta, topSimilarity: found.topSimilarity, retrievedChunkIds: usable.map((c) => c.chunkId) },
  });

  const refused = isDemoRefusal(res.text);
  if (refused) await markRefused(requestId, "model");
  const cost: CostInfo = {
    inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens,
    costUsd: found.embedCostUsd + (() => { try { return computeCost(res.usage, res.model); } catch { return 0; } })(),
    latencyMs: Math.round(performance.now() - started), ttftMs: null, model: label(res.model), provider: res.provider,
  };
  return { answer: res.text.trim(), refused, sources: refused ? [] : [...new Set(usable.map((c) => c.title))], cost };
}
