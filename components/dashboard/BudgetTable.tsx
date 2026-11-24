import { formatCost } from "@/lib/format";
import type { BudgetRow } from "@/lib/metrics/types";
import { td, th } from "./ChartCard";
import { StatusPill } from "./StatusPill";

const FILL = { OK: "var(--viz-good)", Warning: "var(--viz-warning)", Breached: "var(--viz-critical)" } as const;

/** Month-to-date budget use. The meter fill carries severity; the track is a quiet neutral. */
export function BudgetTable({ rows }: { rows: BudgetRow[] }) {
  return (
    <section className="viz-card p-4" aria-label="Budget versus actual">
      <h2 className="font-semibold">Budget vs actual</h2>
      <p className="mb-3 text-xs" style={{ color: "var(--viz-text-2)" }}>Current month to date. Warning at 80%, breached at 100%. Not affected by the date range.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead style={{ color: "var(--viz-text-2)" }}>
            <tr><th className={th}>Agency</th><th className={th}>Budget</th><th className={th}>Spent</th><th className={th}>% used</th><th className={th}>Status</th><th className={th}>Month-end forecast</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.agency} className="border-t" style={{ borderColor: "var(--viz-grid)" }}>
                <td className={`${td} font-medium`}>{r.agency}</td>
                <td className={td}>{formatCost(r.budgetUsd)}</td>
                <td className={td}>{formatCost(r.mtdSpendUsd)}</td>
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full" style={{ background: "var(--viz-track)" }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.pct * 100)} aria-label={`${r.agency} budget used`}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(r.pct, 1) * 100}%`, background: FILL[r.status] }} />
                    </div>
                    <span>{Math.round(r.pct * 100)}%</span>
                  </div>
                </td>
                <td className={td}><StatusPill status={r.status} /></td>
                <td className={td} title="Run-rate: month-to-date spend / days elapsed x days in month">
                  {formatCost(r.forecastMonthEndUsd)}{r.forecastMonthEndUsd > r.budgetUsd && <span style={{ color: "var(--viz-text-2)" }}> (over budget)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
