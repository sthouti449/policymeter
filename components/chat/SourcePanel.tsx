"use client";
import { useEffect } from "react";
import type { Source } from "@/lib/chat/types";
import { StatusBadge } from "./StatusBadge";

/** Side panel with the exact text behind a citation. Esc or the button closes it. */
export function SourcePanel({ source, onClose }: { source: Source; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside aria-label={`Source [${source.n}]`} className="fixed inset-x-0 bottom-0 z-20 max-h-[70vh] overflow-y-auto rounded-t-2xl border bg-white p-5 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-96 md:rounded-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-500">Source [{source.n}]</p>
          <h2 className="font-semibold leading-snug">{source.title}</h2>
        </div>
        <button onClick={onClose} aria-label="Close source" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">&times;</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
        <StatusBadge status={source.status} />
        {source.page != null && <span>page {source.page}</span>}
        <span>similarity {source.similarity.toFixed(2)}</span>
      </div>
      {source.status === "rescinded" && source.replacedBy && (
        <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">Rescinded. Replaced by: {source.replacedBy}</p>
      )}
      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{source.content}</p>
      {source.url && (
        <a href={source.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-blue-700 underline">Open the source document</a>
      )}
    </aside>
  );
}
