"use client";
import { FileText, Info, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { DISCLAIMER } from "@/lib/chat/client";
import type { ChatEvent, Source } from "@/lib/chat/types";
import { CostChip } from "./CostChip";
import { StatusBadge } from "./StatusBadge";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: string;
  feedback?: 1 | -1;
  final?: Extract<ChatEvent, { type: "final" }>;
}

interface Props {
  message: UiMessage;
  onCite: (source: Source) => void;
  onFeedback: (message: UiMessage, value: 1 | -1) => void;
}

/** Turn "[2]" markers into clickable chips that open the source panel. */
function AnswerText({ text, sources, onCite }: { text: string; sources: Source[]; onCite: (s: Source) => void }) {
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-800">
      {text.split(/(\[\d+\])/).map((part, i) => {
        const n = /^\[(\d+)\]$/.exec(part)?.[1];
        const source = n ? sources.find((s) => s.n === Number(n)) : undefined;
        if (!source) return <span key={i}>{part}</span>;
        return (
          <button key={i} onClick={() => onCite(source)} aria-label={`Open source ${source.n}: ${source.title}`}
            className="mx-0.5 inline-grid h-[1.35rem] min-w-[1.35rem] -translate-y-px place-items-center rounded-md bg-brand-100 px-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-600 hover:text-white">
            {source.n}
          </button>
        );
      })}
    </p>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-500" role="status">
      <span className="flex items-center gap-1" aria-hidden><span className="dot" /><span className="dot" /><span className="dot" /></span>
      Searching the documents&hellip;
    </div>
  );
}

export function MessageView({ message, onCite, onFeedback }: Props) {
  if (message.role === "user") {
    return (
      <div className="fade-up ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-[15px] text-white shadow-sm">
        {message.content}
      </div>
    );
  }
  const f = message.final;
  const sources = f?.sources ?? [];
  const cited = sources.filter((s) => f?.citationsUsed.includes(s.n));
  const done = !message.streaming && !message.error;

  return (
    <div className="fade-up flex gap-3">
      <div className="mt-1 hidden sm:block"><LogoMark size={30} /></div>
      <div className="card min-w-0 flex-1 space-y-4 p-4 sm:p-5">
        {message.error ? (
          <p role="alert" className="flex items-start gap-2 text-sm text-red-700"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />{message.error}</p>
        ) : message.streaming && !message.content ? (
          <Thinking />
        ) : (
          <AnswerText text={f?.answer ?? message.content} sources={sources} onCite={onCite} />
        )}

        {f?.refused && (
          <p className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
            <Info size={14} className="shrink-0 text-ink-500" aria-hidden />
            No passage in the loaded documents was similar enough to answer this, so no answer was generated.
          </p>
        )}

        {f && f.rescindedCited.length > 0 && (
          <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-red-600" aria-hidden />
            <p>
              This answer cites a <strong>rescinded</strong> document: {f.rescindedCited.map((s) => s.title).join("; ")}.
              {f.rescindedCited[0].replacedBy && <> Replaced by: {f.rescindedCited[0].replacedBy}.</>}
            </p>
          </div>
        )}

        {cited.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Sources</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {cited.map((s) => (
                <li key={s.n}>
                  <button onClick={() => onCite(s)} className="card-hover flex w-full items-start gap-3 rounded-xl border border-ink-200 bg-white p-3 text-left">
                    <span className="icon-tile !h-9 !w-9 !rounded-lg"><FileText size={16} aria-hidden /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-900"><span className="text-brand-700">[{s.n}]</span> {s.title}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                        {s.page != null && <span>page {s.page}</span>}
                        <StatusBadge status={s.status} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {done && (
          <div className="space-y-3 border-t border-ink-100 pt-3">
            <p className="text-[11px] leading-relaxed text-ink-500">{DISCLAIMER}</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {f && <CostChip cost={f.cost} />}
              {f && (
                <span className="flex items-center gap-1" role="group" aria-label="Was this answer helpful?">
                  {([1, -1] as const).map((v) => {
                    const Icon = v === 1 ? ThumbsUp : ThumbsDown;
                    const on = message.feedback === v;
                    return (
                      <button key={v} onClick={() => onFeedback(message, v)} aria-pressed={on} aria-label={v === 1 ? "Helpful" : "Not helpful"}
                        className={`grid h-8 w-8 place-items-center rounded-full border transition ${on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 text-ink-500 hover:bg-ink-100 hover:text-ink-800"}`}>
                        <Icon size={15} aria-hidden />
                      </button>
                    );
                  })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
