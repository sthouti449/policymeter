"use client";
import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import type { Source } from "@/lib/chat/types";
import { StatusBadge } from "./StatusBadge";

/** Side panel with the exact text behind a citation. Esc or the close button dismisses it. */
export function SourcePanel({ source, onClose }: { source: Source; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-30 bg-ink-900/30 backdrop-blur-[1px] md:hidden" onClick={onClose} aria-hidden />
      <aside aria-label={`Source ${source.n}`}
        className="fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-2xl border border-ink-200 bg-white p-5 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none md:border-y-0 md:border-r-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Source [{source.n}]</p>
            <h2 className="mt-1 text-base font-semibold leading-snug text-ink-900">{source.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close source" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-100"><X size={18} aria-hidden /></button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-600">
          <StatusBadge status={source.status} />
          {source.page != null && <span className="chip">page {source.page}</span>}
          <span className="chip">similarity {source.similarity.toFixed(2)}</span>
        </div>
        {source.status === "rescinded" && source.replacedBy && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">Rescinded. Replaced by: {source.replacedBy}</p>
        )}
        <blockquote className="mt-4 whitespace-pre-wrap rounded-xl border-l-4 border-brand-300 bg-ink-50 p-4 text-sm leading-relaxed text-ink-800">{source.content}</blockquote>
        {source.url && (
          <a href={source.url} target="_blank" rel="noreferrer" className="btn btn-secondary mt-5 !text-brand-700">
            Open the source document <ExternalLink size={14} aria-hidden />
          </a>
        )}
      </aside>
    </>
  );
}
