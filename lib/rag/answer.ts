import "server-only";
import { getPrice } from "@/lib/config";
import { getEnv } from "@/lib/env";
import { looksLikeInjection } from "@/lib/guardrails/injection";
import { chatStream, type StreamEvent } from "@/lib/llm";
import { resolveChat } from "@/lib/llm/resolve";
import { computeCost } from "@/lib/metering/cost";
import { logPreModelRefusal, markRefused } from "@/lib/metering/refusal";
import type { ChatEvent, ChatTurn, CostInfo, RefusalReason, Source } from "@/lib/chat/types";
import { parseCitations } from "./cite";
import { buildContext, buildUserTurn, isRefusal, REFUSAL, SYSTEM_PROMPT } from "./prompt";
import { rewriteQuestion } from "./rewrite";
import { retrieve } from "./retrieve";

export interface AnswerArgs { history: ChatTurn[]; question: string; agency: string; useCase: string; requestId?: string }

const safeCost = (fn: () => number) => {
  try { return fn(); } catch { return 0; } // a missing price must not break an answer
};

/**
 * The whole policy-assistant pipeline (ARCHITECTURE section 3, after guard()):
 * injection check -> rewrite -> retrieve -> threshold -> generate -> cite.
 * Yields delta events while streaming, then exactly one final event.
 * /api/chat and the eval runner both call this, so evals test the real pipeline.
 */
export async function* answerPolicyQuestion(a: AnswerArgs): AsyncGenerator<ChatEvent> {
  const { env, providers } = getEnv();
  const requestId = a.requestId ?? crypto.randomUUID();
  const meta = { requestId, agency: a.agency, useCase: a.useCase, question: a.question };
  const started = performance.now();
  const fast = resolveChat(env, providers.chat, "fast");
  const label = safeLabel(fast.pricingKey);
  let spent = 0; // USD for the whole question: rewrite + embedding + answer

  const refusal = (reason: RefusalReason, sources: Source[] = []): ChatEvent[] => [
    { type: "delta", text: REFUSAL },
    {
      type: "final", requestId, answer: REFUSAL, refused: true, refusalReason: reason, sources, citationsUsed: [], rescindedCited: [],
      cost: { inputTokens: 0, outputTokens: 0, costUsd: spent, latencyMs: Math.round(performance.now() - started), ttftMs: null, model: label, provider: fast.provider },
    },
  ];

  // 1. Obvious injection: refuse before any model is called.
  if (looksLikeInjection(a.question)) {
    await logPreModelRefusal(meta, "injection");
    yield* refusal("injection");
    return;
  }

  // 2. Rewrite follow-ups into standalone questions.
  let standalone = a.question;
  if (a.history.length) {
    const rw = await rewriteQuestion(a.history, a.question, meta);
    standalone = rw.question;
    spent += rw.costUsd;
  }

  // 3. Retrieve, then keep only chunks that clear the similarity threshold.
  const found = await retrieve(standalone, "policy", meta);
  spent += found.embedCostUsd;
  const usable = found.chunks.filter((c) => c.similarity >= env.RAG_MIN_SIMILARITY);
  if (!usable.length) {
    await markRefused(requestId, "low_similarity");
    yield* refusal("low_similarity");
    return;
  }
  const sources: Source[] = usable.map((c, i) => ({
    n: i + 1, chunkId: c.chunkId, docId: c.docId, title: c.title, page: c.page, status: c.status,
    replacedBy: c.replacedBy, url: c.url, content: c.content, similarity: c.similarity,
  }));

  // 4. Generate, streamed. Earlier turns give conversational context.
  const history = a.history.slice(-4).map((t) => ({ role: t.role, content: t.content.slice(0, 1000) }));
  let streamEnd: Extract<StreamEvent, { done: true }> | undefined;
  let firstDeltaMs: number | null = null;
  for await (const ev of chatStream({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: buildUserTurn(buildContext(usable), a.question) },
    ],
    tier: "fast",
    maxTokens: 700,
    meta: { ...meta, topSimilarity: found.topSimilarity, retrievedChunkIds: usable.map((c) => c.chunkId) },
  })) {
    if ("delta" in ev) {
      firstDeltaMs ??= Math.round(performance.now() - started);
      yield { type: "delta", text: ev.delta };
    } else {
      streamEnd = ev;
    }
  }
  if (!streamEnd) throw new Error("The model returned no answer.");
  const done = streamEnd; // const, so TypeScript keeps it narrowed inside closures

  // 5. Clean the citations and report.
  const cited = parseCitations(done.text, sources.length);
  const refused = isRefusal(cited.text);
  if (refused) await markRefused(requestId, "model");
  const used = refused ? [] : cited.used;
  spent += safeCost(() => computeCost(done.usage, done.model));

  const cost: CostInfo = {
    inputTokens: done.usage.inputTokens, outputTokens: done.usage.outputTokens, costUsd: spent,
    latencyMs: Math.round(performance.now() - started), ttftMs: firstDeltaMs, model: safeLabel(done.model), provider: done.provider,
  };
  yield {
    type: "final", requestId, answer: cited.text, refused, refusalReason: refused ? "model" : undefined,
    sources: refused ? [] : sources, citationsUsed: used,
    rescindedCited: sources.filter((s) => used.includes(s.n) && s.status === "rescinded"), cost,
  };
}

function safeLabel(pricingKey: string): string {
  try { return getPrice(pricingKey).label; } catch { return pricingKey; }
}
