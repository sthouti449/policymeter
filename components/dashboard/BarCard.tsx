"use client";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisCost, formatCompact, formatCost, formatInt } from "@/lib/format";
import type { GroupRow } from "@/lib/metrics/types";
import { ChartCard, td, th } from "./ChartCard";

interface Props {
  title: string;
  keyLabel: string; // column heading, e.g. "Agency"
  rows: GroupRow[];
  labelOf?: (key: string) => string;
}

const ink = { fill: "var(--viz-text-2)", fontSize: 12 };

function Tip({ active, payload, keyLabel }: { active?: boolean; payload?: { payload: GroupRow & { name: string } }[]; keyLabel: string }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs shadow-lg" style={{ background: "var(--viz-surface)", borderColor: "var(--viz-border)", color: "var(--viz-text-1)" }}>
      <p className="font-semibold">{r.name}</p>
      <p>{formatCost(r.costUsd)} &middot; {formatInt(r.calls)} calls</p>
      <p style={{ color: "var(--viz-text-2)" }}>{formatCompact(r.inputTokens)} in / {formatCompact(r.outputTokens)} out ({keyLabel.toLowerCase()})</p>
    </div>
  );
}

/** Horizontal bars, one series, so no legend: the title says what is plotted. Value at the bar tip. */
export function BarCard({ title, keyLabel, rows, labelOf = (k) => k }: Props) {
  const data = rows.map((r) => ({ ...r, name: labelOf(r.key) }));
  const top = data[0];
  return (
    <ChartCard
      title={title}
      subtitle="Total spend in the selected period, USD"
      empty={data.length === 0 || data.every((d) => d.costUsd === 0)}
      summary={top ? `${title}. Highest: ${top.name} at ${formatCost(top.costUsd)}. ${data.length} groups.` : title}
      chart={
        <ResponsiveContainer width="100%" height={data.length * 34 + 48}>
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 64, top: 4, bottom: 16 }}>
            <CartesianGrid horizontal={false} stroke="var(--viz-grid)" strokeWidth={1} />
            <XAxis type="number" tickFormatter={formatAxisCost} tick={ink} stroke="var(--viz-axis)" tickLine={false}
              label={{ value: "Spend (USD)", position: "insideBottom", offset: -10, ...ink }} />
            <YAxis type="category" dataKey="name" width={130} tick={ink} stroke="var(--viz-axis)" tickLine={false} interval={0} />
            <Tooltip cursor={{ fill: "var(--viz-grid)", opacity: 0.4 }} content={<Tip keyLabel={keyLabel} />} />
            {/* Thin bar, 4px rounded data end, square at the baseline. */}
            <Bar dataKey="costUsd" fill="var(--viz-brand)" barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="costUsd" position="right" formatter={(v: unknown) => formatCost(Number(v))} style={{ fill: "var(--viz-text-1)", fontSize: 12 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      }
      table={
        <table className="w-full" style={{ color: "var(--viz-text-1)" }}>
          <thead style={{ color: "var(--viz-text-2)" }}><tr><th className={th}>{keyLabel}</th><th className={th}>Calls</th><th className={th}>Tokens in</th><th className={th}>Tokens out</th><th className={th}>Spend</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.key} className="border-t" style={{ borderColor: "var(--viz-grid)" }}>
                <td className={td}>{r.name}</td><td className={td}>{formatInt(r.calls)}</td><td className={td}>{formatInt(r.inputTokens)}</td>
                <td className={td}>{formatInt(r.outputTokens)}</td><td className={td}>{formatCost(r.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}
