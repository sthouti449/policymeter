import "server-only";
import { chat } from "@/lib/llm";
import type { CallMeta } from "@/lib/llm";
import { computeCost } from "@/lib/metering/cost";
import type { ChatTurn } from "@/lib/chat/types";
import { REWRITE_PROMPT } from "./prompt";

const HISTORY_TURNS = 4; // how many earlier messages the rewriter may see

/**
 * Turn a follow-up like "and what about that one?" into a standalone question so
 * retrieval works. Only called when there is earlier history. On any failure we
 * fall back to the original question: a rewrite is a nicety, never a blocker.
 */
export async function rewriteQuestion(
  history: ChatTurn[],
  question: string,
  meta: CallMeta,
): Promise<{ question: string; costUsd: number }> {
  try {
    const recent = history.slice(-HISTORY_TURNS).map((t) => `${t.role}: ${t.content.slice(0, 600)}`).join("\n");
    const res = await chat({
      messages: [
        { role: "system", content: REWRITE_PROMPT },
        { role: "user", content: `Earlier turns:\n${recent}\n\nLast message: ${question}` },
      ],
      tier: "fast",
      maxTokens: 150,
      meta: { requestId: meta.requestId, agency: meta.agency, useCase: "query-rewrite" },
    });
    const rewritten = res.text.trim().replace(/^["']|["']$/g, "");
    return { question: rewritten || question, costUsd: computeCost(res.usage, res.model) };
  } catch (err) {
    console.error("rewrite failed, using original question:", err instanceof Error ? err.message : err);
    return { question, costUsd: 0 };
  }
}
