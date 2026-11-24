"use client";
import { useEffect, useState } from "react";
import { formatCost, formatInt, formatMs } from "@/lib/format";
import { filtersToQuery } from "@/lib/metrics/query-string";
import type { CallRow, Filters } from "@/lib/metrics/types";
import { td, th } from "./ChartCard";

const PAGE_SIZE = 15;

/** Recent calls for the current filters, newest first, with a Trace button per row. */
export function CallsTable({ apiBase, filters, modelLabels, onTrace }: { apiBase: string; filters: Filters; modelLabels: Record<string, string>; onTrace: (requestId: string) => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: CallRow[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = filtersToQuery(filters);

  useEffect(() => setPage(1), [query]);
  useEffect(() => {
    const ctl = new AbortController();
    setError(null);
    fetch(`${apiBase}/calls${filtersToQuery(filters, { page, pageSize: PAGE_SIZE })}`, { signal: ctl.signal })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error ?? "Could not load calls."))))
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `query` is the serialised `filters`
  }, [query, page, apiBase]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return (
    <section className="viz-card p-4" aria-label="Recent calls">
      <h2 className="font-semibold">Recent calls</h2>
      <p className="mb-3 text-xs" style={{ color: "var(--viz-text-2)" }}>Every model call in range. Open a trace to see the retrieved chunks and per-step cost.</p>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {!data && !error && <p className="py-6 text-center text-sm" style={{ color: "var(--viz-muted)" }}>Loading&hellip;</p>}
      {data && data.rows.length === 0 && <p className="py-6 text-center text-sm" style={{ color: "var(--viz-muted)" }}>No calls for these filters.</p>}
      {data && data.rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead style={{ color: "var(--viz-text-2)" }}>
                <tr><th className={th}>Time (UTC)</th><th className={th}>Agency</th><th className={th}>Use case</th><th className={th}>Model</th><th className={th}>Tokens in/out</th><th className={th}>Latency</th><th className={th}>Cost</th><th className={th}>Status</th><th className={th}><span className="sr-only">Trace</span></th></tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: "var(--viz-grid)" }}>
                    <td className={td}>{r.createdAt.slice(5, 16).replace("T", " ")}</td>
                    <td className={td}>{r.agency}{r.simulated && <span style={{ color: "var(--viz-text-2)" }} title="Simulated traffic"> *</span>}</td>
                    <td className={td}>{r.useCase}</td>
                    <td className={td}>{modelLabels[r.model] ?? r.model}</td>
                    <td className={td}>{formatInt(r.inputTokens)} / {formatInt(r.outputTokens)}</td>
                    <td className={td}>{formatMs(r.latencyMs)}</td>
                    <td className={td}>{formatCost(r.costUsd)}</td>
                    <td className={td}>{r.status}</td>
                    <td className={td}><button onClick={() => onTrace(r.requestId)} className="rounded-md border px-2 py-0.5 text-xs" style={{ borderColor: "var(--viz-border)" }}>Trace</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--viz-text-2)" }}>
            <span>{formatInt(data.total)} calls &middot; * simulated</span>
            <span className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border px-2 py-1 disabled:opacity-40" style={{ borderColor: "var(--viz-border)" }}>Previous</button>
              Page {page} of {pages}
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border px-2 py-1 disabled:opacity-40" style={{ borderColor: "var(--viz-border)" }}>Next</button>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
