"use client";
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
    <p className="whitespace-pre-wrap leading-relaxed">
      {text.split(/(\[\d+\])/).map((part, i) => {
        const n = /^\[(\d+)\]$/.exec(part)?.[1];
        const source = n ? sources.find((s) => s.n === Number(n)) : undefined;
        if (!source) return <span key={i}>{part}</span>;
        return (
          <button key={i} onClick={() => onCite(source)} aria-label={`Open source ${source.n}: ${source.title}`}
            className="mx-0.5 rounded bg-blue-50 px-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
            {source.n}
          </button>
        );
      })}
    </p>
  );
}

export function MessageView({ message, onCite, onFeedback }: Props) {
  if (message.role === "user") {
    return <div className="ml-auto max-w-[85%] rounded-2xl bg-black px-4 py-2 text-white">{message.content}</div>;
  }
  const f = message.final;
  const sources = f?.sources ?? [];
  const cited = sources.filter((s) => f?.citationsUsed.includes(s.n));

  return (
    <div className="max-w-[95%] space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
      {message.error ? (
        <p role="alert" className="text-red-700">{message.error}</p>
      ) : (
        <AnswerText text={f?.answer ?? message.content} sources={sources} onCite={onCite} />
      )}
      {message.streaming && !message.content && <p className="text-sm text-neutral-500">Searching the documents&hellip;</p>}

      {f && f.rescindedCited.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          This answer cites a <strong>rescinded</strong> document: {f.rescindedCited.map((s) => s.title).join("; ")}.
          {f.rescindedCited[0].replacedBy && <> Replaced by: {f.rescindedCited[0].replacedBy}.</>}
        </div>
      )}

      {cited.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {cited.map((s) => (
            <li key={s.n}>
              <button onClick={() => onCite(s)} className="w-full rounded-lg border p-2 text-left text-sm hover:bg-neutral-50">
                <span className="font-semibold text-blue-700">[{s.n}]</span> {s.title}
                <span className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  {s.page != null && <span>p.{s.page}</span>}
                  <StatusBadge status={s.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!message.streaming && !message.error && (
        <>
          <p className="text-xs text-neutral-500">{DISCLAIMER}</p>
          <div className="flex flex-wrap items-center gap-3">
            {f && <CostChip cost={f.cost} />}
            {f && (
              <span className="flex gap-1" role="group" aria-label="Was this answer helpful?">
                {([1, -1] as const).map((v) => (
                  <button key={v} onClick={() => onFeedback(message, v)} aria-pressed={message.feedback === v}
                    aria-label={v === 1 ? "Helpful" : "Not helpful"}
                    className={`rounded border px-2 py-0.5 text-sm ${message.feedback === v ? "bg-black text-white" : "hover:bg-neutral-100"}`}>
                    {v === 1 ? "\u{1F44D}" : "\u{1F44E}"}
                  </button>
                ))}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
