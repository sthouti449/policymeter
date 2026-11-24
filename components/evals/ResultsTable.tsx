"use client";
import { Fragment, useState } from "react";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import type { ResultRow } from "@/lib/evals/types";

const yesNo = (v: boolean | null) => (v == null ? <span style={{ color: "var(--viz-muted)" }}>n/a</span> : v ? <Check size={15} aria-label="yes" /> : <X size={15} aria-label="no" />);

/** Every golden-set question. A question needs a look when it misses a phrase, is refused wrongly, or scores under 4. */
export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const needsLook = (r: ResultRow) => r.misses.length > 0 || r.refused !== r.shouldRefuse || (r.groundedness != null && r.groundedness < 4);

  return (
    <section className="viz-card p-4" aria-label="Questions">
      <h2 className="font-semibold">Questions</h2>
      <p className="mb-3 text-xs" style={{ color: "var(--viz-text-2)" }}>Open a row to read the answer, the judge&rsquo;s reason and any phrases the answer should have mentioned.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead style={{ color: "var(--viz-text-2)" }}>
            <tr>{["", "Question", "Right doc", "Cited", "Refused", "Grounded", "Missing phrases", "Cost"].map((h, i) => <th key={i} className="py-1.5 pr-3 text-left text-xs font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = open.has(r.id);
              return (
                <Fragment key={r.id}>
                  <tr className="border-t align-top" style={{ borderColor: "var(--viz-grid)" }}>
                    <td className="py-2 pr-1">
                      <button onClick={() => toggle(r.id)} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} details for ${r.questionId}`}>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td className="py-2 pr-3"><span className="font-mono text-xs" style={{ color: "var(--viz-text-2)" }}>{r.questionId}</span><br />{r.question}{needsLook(r) && <span className="ml-2 rounded-full border px-1.5 text-xs" style={{ borderColor: "var(--viz-border)" }}>needs a look</span>}</td>
                    <td className="pr-3">{yesNo(r.hit)}</td><td className="pr-3">{yesNo(r.cited)}</td>
                    <td className="pr-3">{r.refused ? "yes" : "no"}{r.shouldRefuse ? " (expected)" : ""}</td>
                    <td className="pr-3">{r.groundedness ?? "n/a"}</td>
                    <td className="pr-3">{r.misses.length ? r.misses.join("; ") : "none"}</td>
                    <td>${r.costUsd.toFixed(4)}</td>
                  </tr>
                  {isOpen && (
                    <tr style={{ background: "var(--viz-page)" }}>
                      <td />
                      <td colSpan={7} className="space-y-2 py-3 pr-3">
                        <p><strong>Answer:</strong> <span className="whitespace-pre-wrap">{r.answer}</span></p>
                        {r.judgeReason && <p><strong>Judge:</strong> {r.judgeReason}</p>}
                        <p className="text-xs" style={{ color: "var(--viz-text-2)" }}>
                          Expected: {r.expectedDocIds.join(", ") || "none"} &middot; Retrieved: {r.retrievedDocIds.join(", ") || "none"} &middot; Request {r.requestId}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
