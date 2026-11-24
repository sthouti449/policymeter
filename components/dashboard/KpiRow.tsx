import { Activity, Clock, DollarSign, Layers, Receipt, type LucideIcon } from "lucide-react";
import { formatCompact, formatCost, formatInt, formatMs } from "@/lib/format";
import type { Kpis } from "@/lib/metrics/types";

function Tile({ Icon, label, value, note }: { Icon: LucideIcon; label: string; value: string; note?: string }) {
  return (
    <div className="viz-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="icon-tile !h-8 !w-8 !rounded-lg"><Icon size={16} aria-hidden /></span>
        <p className="text-xs font-medium leading-tight text-ink-600">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
      {note && <p className="mt-0.5 text-xs text-ink-500">{note}</p>}
    </div>
  );
}

/** Five headline numbers. Money shows 4 decimals under $1 and 2 above. */
export function KpiRow({ kpis }: { kpis: Kpis }) {
  const cpq = kpis.costPerAnsweredQuestion;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <Tile Icon={DollarSign} label="Total spend" value={formatCost(kpis.spendUsd)} note="all calls in range" />
      <Tile Icon={Activity} label="Calls" value={formatInt(kpis.calls)} note="chat and embedding" />
      <Tile Icon={Receipt} label="Cost per answered question" value={cpq == null ? "n/a" : formatCost(cpq)} note={`${formatInt(kpis.answeredQuestions)} answered, all calls included`} />
      <Tile Icon={Clock} label="Avg answer latency" value={formatMs(kpis.avgAnswerLatencyMs)} note="end of answer, per question" />
      <Tile Icon={Layers} label="Tokens" value={formatCompact(kpis.inputTokens + kpis.outputTokens)} note={`${formatCompact(kpis.inputTokens)} in / ${formatCompact(kpis.outputTokens)} out`} />
    </div>
  );
}
