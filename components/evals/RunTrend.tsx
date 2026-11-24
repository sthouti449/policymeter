"use client";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RunRow } from "@/lib/evals/types";

const ink = { fill: "var(--viz-text-2)", fontSize: 12 };
const pct = (v: number | null) => (v == null ? "n/a" : `${(v * 100).toFixed(0)}%`);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Past runs: one line (groundedness, the headline quality score) plus a table with every metric. */
export function RunTrend({ runs, selectedId }: { runs: RunRow[]; selectedId: string }) {
  const series = [...runs].reverse().filter((r) => r.groundednessAvg != null).map((r, i) => ({ run: i + 1, label: when(r.createdAt), groundedness: r.groundednessAvg }));
  return (
    <section className="viz-card p-4" aria-label="Run history">
      <h2 className="font-semibold">Run history</h2>
      <p className="mb-3 text-xs" style={{ color: "var(--viz-text-2)" }}>Groundedness by run (the PRD target is 4.2 or higher). Select a run to see its questions.</p>

      {series.length >= 2 && (
        <div role="img" aria-label={`Groundedness over ${series.length} runs, latest ${series.at(-1)?.groundedness?.toFixed(2)} out of 5`}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={series} margin={{ left: 4, right: 16, top: 8, bottom: 20 }}>
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
              <XAxis dataKey="run" tick={ink} stroke="var(--viz-axis)" tickLine={false} allowDecimals={false}
                label={{ value: "Run (oldest to newest)", position: "insideBottom", offset: -12, ...ink }} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={ink} stroke="var(--viz-axis)" tickLine={false} width={44}
                label={{ value: "Score (1-5)", angle: -90, position: "insideLeft", offset: 8, ...ink }} />
              <Tooltip formatter={(v) => Number(v).toFixed(2)} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} contentStyle={{ background: "var(--viz-surface)", border: "1px solid var(--viz-border)", borderRadius: 8 }} />
              {/* 2px line, round joins, 8px dots with a surface-coloured ring. */}
              <Line type="monotone" dataKey="groundedness" name="Groundedness" stroke="var(--viz-brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                dot={{ r: 4, fill: "var(--viz-brand)", stroke: "var(--viz-surface)", strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead style={{ color: "var(--viz-text-2)" }}>
            <tr>{["When", "Hit rate", "Citations", "Grounded", "Refusals", "TTFT p50", "Cost"].map((h) => <th key={h} className="py-1.5 pr-3 text-left text-xs font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: "var(--viz-grid)", fontWeight: r.id === selectedId ? 600 : 400 }}>
                <td className="py-1.5 pr-3"><Link href={`/evals?run=${r.id}`} className="underline" aria-current={r.id === selectedId ? "true" : undefined}>{when(r.createdAt)}</Link></td>
                <td className="pr-3">{pct(r.retrievalHitRate)}</td><td className="pr-3">{pct(r.citationRate)}</td>
                <td className="pr-3">{r.groundednessAvg == null ? "n/a" : r.groundednessAvg.toFixed(2)}</td><td className="pr-3">{pct(r.refusalAccuracy)}</td>
                <td className="pr-3">{r.p50TtftMs == null ? "n/a" : `${(r.p50TtftMs / 1000).toFixed(1)} s`}</td><td>{r.totalCostUsd == null ? "n/a" : `$${r.totalCostUsd.toFixed(4)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
