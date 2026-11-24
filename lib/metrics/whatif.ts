import type { ModelRow, PriceInfo } from "./types";

export interface WhatIf {
  actualUsd: number; // what the chat calls actually cost
  whatIfUsd: number; // the same token counts priced on the chosen model
  differencePct: number | null; // negative = cheaper; null when there is no actual spend
  embeddingUsd: number; // unchanged by the choice, shown separately
}

/**
 * "If this traffic ran on model X": re-price the logged CHAT tokens with X's prices.
 * Embeddings are left alone because the chosen model doesn't affect them.
 *
 * Approximation to state in the UI: it reuses the logged token counts, and models
 * from different families count tokens differently. Cache-write tokens aren't
 * stored separately, so they are priced as ordinary input.
 */
export function whatIf(byModel: ModelRow[], target: PriceInfo): WhatIf {
  const chat = byModel.filter((r) => r.operation === "chat");
  const actualUsd = chat.reduce((s, r) => s + r.costUsd, 0);
  const embeddingUsd = byModel.filter((r) => r.operation === "embed").reduce((s, r) => s + r.costUsd, 0);

  const whatIfUsd = chat.reduce((s, r) => {
    const fresh = Math.max(0, r.inputTokens - r.cachedInputTokens);
    return s + (fresh * target.input + r.cachedInputTokens * target.cachedInput + r.outputTokens * target.output) / 1e6;
  }, 0);

  return { actualUsd, whatIfUsd, embeddingUsd, differencePct: actualUsd > 0 ? ((whatIfUsd - actualUsd) / actualUsd) * 100 : null };
}
