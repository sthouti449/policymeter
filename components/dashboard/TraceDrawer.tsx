"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { formatCost, formatInt, formatMs } from "@/lib/format";
import type { TracePayload } from "@/lib/metrics/types";
import { td, th } from "./ChartCard";

/** One question: every call it made, and the chunks it retrieved with their scores. Esc closes. */
export function TraceDrawer({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [trace, setTrace] = useState<TracePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let live = true;
    fetch(`/api/trace/${requestId}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error ?? "Trace not found."))))
      .then((t) => live && setTrace(t))
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [requestId]);

  return (
    <aside role="dialog" aria-label="Request trace" className="fixed inset-x-0 bottom-0 z-30 max-h-[80vh] overflow-y-auto rounded-t-2xl border p-5 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[32rem] md:rounded-none"
      style={{ background: "var(--viz-surface)", borderColor: "var(--viz-border)", color: "var(--viz-text-1)" }}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold">Request trace</h2>
          <p className="break-all font-mono text-xs" style={{ color: "var(--viz-text-2)" }}>{requestId}</p>
        </div>
        <button onClick={onClose} aria-label="Close trace" className="rounded p-1"><X size={18} /></button>
      </div>

      {error && <p role="alert" className="mt-4 text-sm">{error}</p>}
      {!trace && !error && <p className="mt-4 text-sm" style={{ color: "var(--viz-text-2)" }}>Loading&hellip;</p>}
      {trace && (
        <div className="mt-4 space-y-5">
          <section>
            <h3 className="mb-1 text-sm font-medium">Calls &middot; total {formatCost(trace.totalCostUsd)}</h3>
            <table className="w-full">
              <thead style={{ color: "var(--viz-text-2)" }}><tr><th className={th}>Step</th><th className={th}>Tokens in/out</th><th className={th}>Latency</th><th className={th}>Cost</th></tr></thead>
              <tbody>
                {trace.calls.map((c) => (
                  <tr key={c.id} className="border-t" style={{ borderColor: "var(--viz-grid)" }}>
                    <td className={td}>{c.operation === "embed" ? "embed" : c.useCase === "query-rewrite" ? "rewrite" : "answer"}{c.status !== "ok" && <span style={{ color: "var(--viz-text-2)" }}> ({c.status})</span>}</td>
                    <td className={td}>{formatInt(c.inputTokens)} / {formatInt(c.outputTokens)}</td>
                    <td className={td}>{formatMs(c.latencyMs)}{c.ttftMs != null && <span style={{ color: "var(--viz-text-2)" }}> (first token {formatMs(c.ttftMs)})</span>}</td>
                    <td className={td}>{formatCost(c.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-medium">Retrieved chunks</h3>
            {trace.retrieval.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--viz-text-2)" }}>No retrieval recorded for this request.</p>
            ) : (
              <ul className="space-y-2">
                {trace.retrieval.map((c) => (
                  <li key={c.chunkId} className="text-sm">
                    <p>{c.title} <span style={{ color: "var(--viz-text-2)" }}>&middot; {c.page != null ? `p.${c.page}` : "no page"} &middot; {c.status}</span></p>
                    <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--viz-text-2)" }}>
                      <div className="h-1.5 w-28 overflow-hidden rounded-full" style={{ background: "var(--viz-track)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, c.similarity)) * 100}%`, background: "var(--viz-series-1)" }} />
                      </div>
                      similarity {c.similarity.toFixed(3)} &middot; {c.usedInPrompt ? "used in the answer prompt" : "below threshold, not used"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
