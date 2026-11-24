import type { CostInfo } from "@/lib/chat/types";
import { formatCost } from "@/lib/chat/client";

/** "1,240 in · 210 out · $0.0004 · 1.8 s · Claude Haiku 5.5 via anthropic" */
export function CostChip({ cost }: { cost: CostInfo }) {
  const parts = [
    `${cost.inputTokens.toLocaleString()} in`,
    `${cost.outputTokens.toLocaleString()} out`,
    formatCost(cost.costUsd),
    `${(cost.latencyMs / 1000).toFixed(1)} s`,
    `${cost.model} via ${cost.provider}`,
  ];
  return (
    <span title="Cost covers the whole question: rewrite, embedding and answer" className="inline-block rounded-full bg-neutral-100 px-3 py-1 font-mono text-xs text-neutral-600">
      {parts.join(" · ")}
    </span>
  );
}
