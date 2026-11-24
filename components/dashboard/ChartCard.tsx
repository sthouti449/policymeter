"use client";
import { useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";

interface Props {
  title: string;
  subtitle: string;
  summary: string; // read aloud by screen readers instead of the SVG
  empty: boolean;
  chart: ReactNode;
  table: ReactNode;
}

/** A chart with a "Table" switch: the same numbers as text (accessibility, and relief for low-contrast hues). */
export function ChartCard({ title, subtitle, summary, empty, chart, table }: Props) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="viz-card p-4" aria-label={title}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold" style={{ color: "var(--viz-text-1)" }}>{title}</h2>
          <p className="text-xs" style={{ color: "var(--viz-text-2)" }}>{subtitle}</p>
        </div>
        {!empty && (
          <button onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--viz-border)", color: "var(--viz-text-2)" }}>
            {asTable ? <BarChart3 size={14} aria-hidden /> : <Table2 size={14} aria-hidden />}
            {asTable ? "Chart" : "Table"}
          </button>
        )}
      </header>
      {empty ? (
        <p className="py-10 text-center text-sm" style={{ color: "var(--viz-muted)" }}>No spend for these filters.</p>
      ) : asTable ? (
        <div className="max-h-72 overflow-auto">{table}</div>
      ) : (
        <div role="img" aria-label={summary}>{chart}</div>
      )}
    </section>
  );
}

export const th = "py-1.5 pr-3 text-left text-xs font-medium";
export const td = "py-1.5 pr-3 text-sm tabular-nums";
