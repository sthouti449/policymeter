"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisCost, formatCost } from "@/lib/format";
import { toDailySeries } from "@/lib/metrics/daily";
import { agencyColor } from "@/lib/metrics/palette";
import type { DailyRow } from "@/lib/metrics/types";
import { ChartCard, td, th } from "./ChartCard";

interface Props { rows: DailyRow[]; from: string; to: string; agencies: string[] }

const ink = { fill: "var(--viz-text-2)", fontSize: 12 };
const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Tip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-lg border px-3 py-2 text-xs shadow-lg" style={{ background: "var(--viz-surface)", borderColor: "var(--viz-border)", color: "var(--viz-text-1)" }}>
      <p className="font-semibold">{shortDay(String(label))}</p>
      {items.length === 0 && <p style={{ color: "var(--viz-text-2)" }}>No spend</p>}
      {items.map((p) => <p key={p.dataKey}>{p.dataKey}: {formatCost(p.value)}</p>)}
    </div>
  );
}

/** Daily spend stacked by agency. Stack order and colours are fixed (agencies.json order). */
export function DailyCard({ rows, from, to, agencies }: Props) {
  const data = toDailySeries(rows, from, to, agencies);
  const active = agencies.filter((a) => data.some((d) => Number(d[a]) > 0));
  const total = rows.reduce((s, r) => s + r.costUsd, 0);

  return (
    <ChartCard
      title="Daily spend"
      subtitle="USD per day (UTC), stacked by agency"
      empty={total === 0}
      summary={`Daily spend from ${from} to ${to}, total ${formatCost(total)}, across ${active.length} agencies.`}
      chart={
        <>
          {/* Legend: always present for 2+ series, so identity never depends on colour alone. */}
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--viz-text-2)" }}>
            {active.map((a) => (
              <li key={a} className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: agencyColor(a, agencies) }} />{a}
              </li>
            ))}
          </ul>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ left: 4, right: 8, top: 4, bottom: 20 }}>
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={ink} stroke="var(--viz-axis)" tickLine={false} minTickGap={24}
                label={{ value: "Day (UTC)", position: "insideBottom", offset: -12, ...ink }} />
              <YAxis tickFormatter={formatAxisCost} tick={ink} stroke="var(--viz-axis)" tickLine={false} width={64}
                label={{ value: "USD per day", angle: -90, position: "insideLeft", offset: 4, ...ink }} />
              <Tooltip cursor={{ fill: "var(--viz-grid)", opacity: 0.4 }} content={<Tip />} />
              {/* A 2px stroke in the surface colour is the gap between stacked segments. */}
              {agencies.map((a) => (
                <Bar key={a} dataKey={a} stackId="spend" fill={agencyColor(a, agencies)} stroke="var(--viz-surface)" strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </>
      }
      table={
        <table className="w-full" style={{ color: "var(--viz-text-1)" }}>
          <thead style={{ color: "var(--viz-text-2)" }}><tr><th className={th}>Day</th>{active.map((a) => <th key={a} className={th}>{a}</th>)}<th className={th}>Total</th></tr></thead>
          <tbody>
            {data.filter((d) => active.some((a) => Number(d[a]) > 0)).map((d) => (
              <tr key={d.day} className="border-t" style={{ borderColor: "var(--viz-grid)" }}>
                <td className={td}>{d.day}</td>
                {active.map((a) => <td key={a} className={td}>{formatCost(Number(d[a]))}</td>)}
                <td className={td}>{formatCost(active.reduce((s, a) => s + Number(d[a]), 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}
