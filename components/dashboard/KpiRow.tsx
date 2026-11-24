import { formatCompact, formatCost, formatInt, formatMs } from "@/lib/format";
import type { Kpis } from "@/lib/metrics/types";

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="viz-card p-4">
      <p className="text-xs" style={{ color: "var(--viz-text-2)" }}>{label}</p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--viz-text-1)" }}>{value}</p>
      {note && <p className="mt-0.5 text-xs" style={{ color: "var(--viz-muted)" }}>{note}</p>}
    </div>
  );
}

/** Five headline numbers. Money shows 4 decimals under $1 and 2 above. */
export function KpiRow({ kpis }: { kpis: Kpis }) {
  const cpq = kpis.costPerAnsweredQuestion;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <Tile label="Total spend" value={formatCost(kpis.spendUsd)} note="all calls in range" />
      <Tile label="Calls" value={formatInt(kpis.calls)} note="chat and embedding" />
      <Tile label="Cost per answered question" value={cpq == null ? "n/a" : formatCost(cpq)} note={`${formatInt(kpis.answeredQuestions)} answered, all calls included`} />
      <Tile label="Avg answer latency" value={formatMs(kpis.avgAnswerLatencyMs)} note="end of answer, per question" />
      <Tile label="Tokens" value={formatCompact(kpis.inputTokens + kpis.outputTokens)} note={`${formatCompact(kpis.inputTokens)} in / ${formatCompact(kpis.outputTokens)} out`} />
    </div>
  );
}
