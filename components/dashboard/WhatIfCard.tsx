"use client";
import { useState } from "react";
import { formatCost } from "@/lib/format";
import type { MetricsPayload } from "@/lib/metrics/types";
import { whatIf } from "@/lib/metrics/whatif";

/** Re-prices this period's logged chat tokens on another model. Embeddings are unchanged. */
export function WhatIfCard({ data }: { data: MetricsPayload }) {
  const [key, setKey] = useState(data.chatModels[0]?.key ?? "");
  const target = data.chatModels.find((m) => m.key === key) ?? data.chatModels[0];
  const chatSpend = data.byModel.filter((r) => r.operation === "chat").reduce((s, r) => s + r.costUsd, 0);
  const hasChat = data.byModel.some((r) => r.operation === "chat" && r.inputTokens + r.outputTokens > 0);
  const result = target && hasChat ? whatIf(data.byModel, target) : null;

  return (
    <section className="viz-card p-4" aria-label="Model what-if">
      <h2 className="font-semibold">Model what-if</h2>
      <p className="mb-3 text-xs" style={{ color: "var(--viz-text-2)" }}>Same logged tokens, priced on a different model.</p>
      <label className="grid gap-1 text-xs" style={{ color: "var(--viz-text-2)" }}>If this traffic ran on
        <select value={key} onChange={(e) => setKey(e.target.value)} className="rounded-md border bg-transparent px-2 py-1.5 text-sm" style={{ borderColor: "var(--viz-border)", color: "var(--viz-text-1)" }}>
          {data.chatModels.map((m) => <option key={m.key} value={m.key} style={{ color: "#0b0b0b" }}>{m.label}{m.input === 0 ? " (price not set)" : ""}</option>)}
        </select>
      </label>
      {!result || !target ? (
        <p className="mt-4 text-sm" style={{ color: "var(--viz-text-2)" }}>No chat calls in this period to re-price.</p>
      ) : (
        <div className="mt-4 space-y-2 text-sm">
          <p>
            This period&rsquo;s chat traffic would cost <strong>{formatCost(result.whatIfUsd)}</strong> on {target.label}
            {" "}(vs <strong>{formatCost(result.actualUsd)}</strong> actual
            {result.differencePct != null && <>, {Math.abs(result.differencePct).toFixed(0)}% {result.differencePct <= 0 ? "cheaper" : "more expensive"}</>}).
          </p>
          {target.input === 0 && <p role="alert" style={{ color: "var(--viz-text-1)" }}>This model has a price of 0 in config/pricing.json, so the figure is understated.</p>}
          <p className="text-xs" style={{ color: "var(--viz-text-2)" }}>
            Embeddings ({formatCost(result.embeddingUsd)}) are unchanged. Uses the logged token counts; other model families count tokens differently, so treat it as an estimate. Chat spend in range: {formatCost(chatSpend)}.
          </p>
        </div>
      )}
    </section>
  );
}
