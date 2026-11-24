import "server-only";
import { getEnv } from "@/lib/env";
import { resolveChat } from "@/lib/llm/resolve";
import type { ChatEvent } from "@/lib/chat/types";
import { answerPolicyQuestion } from "@/lib/rag/answer";
import { loadGoldenSet, type GoldenItem } from "./golden";
import { judgeAnswer } from "./judge";
import { mapLimit } from "./pool";
import { checkMentions, checkTargets, summarize } from "./score";
import { saveRun } from "./store";
import type { ItemResult, RunSummary, TargetResult } from "./types";

type Final = Extract<ChatEvent, { type: "final" }>;
const CONCURRENCY = 4; // enough to finish well inside a 60 s function, gentle on provider rate limits

async function runItem(item: GoldenItem, judgeCosts: Map<string, number>): Promise<ItemResult> {
  const requestId = crypto.randomUUID();
  const base = { questionId: item.id, question: item.question, expectedDocIds: item.expected_doc_ids, shouldRefuse: item.should_refuse, requestId };
  const started = performance.now();

  let final: Final | undefined;
  try {
    // The SAME pipeline as /api/chat. Agency VITA, use case eval-run: metered, but never rate limited.
    for await (const ev of answerPolicyQuestion({ history: [], question: item.question, agency: "VITA", useCase: "eval-run", requestId })) {
      if (ev.type === "final") final = ev;
    }
  } catch (err) {
    console.error(`eval ${item.id} failed:`, err instanceof Error ? err.message : err);
  }
  if (!final) {
    // A pipeline error counts against the run instead of silently dropping the question.
    return { ...base, answer: "[pipeline error]", retrievedDocIds: [], refused: false, hit: item.should_refuse ? null : false, cited: item.should_refuse ? null : false,
      groundedness: null, judgeReason: null, misses: item.should_refuse ? [] : checkMentions("", item.must_mention), ttftMs: null, latencyMs: Math.round(performance.now() - started), costUsd: 0 };
  }

  let groundedness: number | null = null;
  let judgeReason: string | null = null;
  let judgeCost = 0;
  if (!item.should_refuse && !final.refused && final.sources.length) {
    const j = await judgeAnswer(item.question, final.sources, final.answer, { requestId, agency: "VITA", useCase: "eval-run" });
    judgeCost = j.costUsd;
    groundedness = j.verdict?.score ?? null;
    judgeReason = j.verdict?.reason ?? "The judge did not return valid JSON.";
  }
  judgeCosts.set(requestId, judgeCost);

  return {
    ...base, answer: final.answer, retrievedDocIds: final.retrievedDocIds, refused: final.refused,
    hit: item.should_refuse ? null : item.expected_doc_ids.some((d) => final!.retrievedDocIds.includes(d)),
    cited: item.should_refuse ? null : !final.refused && final.citationsUsed.length > 0,
    groundedness, judgeReason, misses: item.should_refuse ? [] : checkMentions(final.answer, item.must_mention),
    ttftMs: final.cost.ttftMs, latencyMs: final.cost.latencyMs, costUsd: final.cost.costUsd + judgeCost,
  };
}

export interface RunResult { runId: string; summary: RunSummary; targets: TargetResult[]; items: ItemResult[] }

/** Run the golden set through the real pipeline, score it, and store the run. `only` limits it to some question ids. */
export async function runEvals(opts: { only?: string[] } = {}): Promise<RunResult> {
  const { env, providers } = getEnv();
  const golden = loadGoldenSet().filter((g) => !opts.only?.length || opts.only.includes(g.id));
  if (!golden.length) throw new Error("No golden-set questions match.");

  const judgeCosts = new Map<string, number>();
  const items = await mapLimit(golden, CONCURRENCY, (g) => runItem(g, judgeCosts));
  const summary = summarize(items, judgeCosts);
  const targets = checkTargets(summary);

  const errors = items.filter((i) => i.answer === "[pipeline error]").length;
  const notes = [
    `similarity threshold ${env.RAG_MIN_SIMILARITY}`, `false refusals ${summary.falseRefusals}`, `must_mention misses ${summary.mentionMisses}`,
    `judge failures ${summary.judgeFailures}`, `pipeline errors ${errors}`,
    `p50 total latency ${summary.p50LatencyMs ?? "n/a"} ms`, `judge ${resolveChat(env, providers.chat, "smart").pricingKey}`,
  ].join("; ");
  const fast = resolveChat(env, providers.chat, "fast");
  const runId = await saveRun({ provider: fast.provider, model: fast.pricingKey, summary, items, notes });
  return { runId, summary, targets, items };
}
