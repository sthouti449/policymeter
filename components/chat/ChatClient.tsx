"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, ClipboardCheck, FileText, Landmark, ListChecks, Scale } from "lucide-react";
import { sendFeedback, streamChat } from "@/lib/chat/client";
import type { Source } from "@/lib/chat/types";
import { MessageView, type UiMessage } from "./MessageView";
import { SourcePanel } from "./SourcePanel";

const STARTERS = [
  { text: "What disclaimer must AI-generated outputs include?", Icon: FileText },
  { text: "Do agencies have to register AI systems?", Icon: ClipboardCheck },
  { text: "Is Executive Order 30 still in effect?", Icon: Scale },
  { text: "What does an Algorithmic Impact Assessment ask about?", Icon: ListChecks },
  { text: "Which AI tools may agencies use?", Icon: Landmark },
];

interface Option { code: string; name: string }
interface Props { agencies: Option[]; useCases: Option[]; lastIngested: string | null }

export function ChatClient({ agencies, useCases, lastIngested }: Props) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [agency, setAgency] = useState(agencies[0]?.code ?? "VITA");
  const [useCase, setUseCase] = useState(useCases[0]?.code ?? "policy-qa");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  const patch = (id: string, change: Partial<UiMessage> | ((m: UiMessage) => Partial<UiMessage>)) =>
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, ...(typeof change === "function" ? change(m) : change) } : m)));

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const id = crypto.randomUUID();
    // Earlier finished turns give the server context for follow-ups.
    const history = messages.filter((m) => !m.error && !m.streaming).map((m) => ({ role: m.role, content: m.final?.answer ?? m.content }));
    setMessages((all) => [...all, { id: `${id}-u`, role: "user", content: text }, { id, role: "assistant", content: "", streaming: true }]);
    setInput("");
    setBusy(true);
    try {
      await streamChat({ messages: [...history, { role: "user", content: text }], agency, useCase }, (ev) => {
        if (ev.type === "delta") patch(id, (m) => ({ content: m.content + ev.text }));
        else if (ev.type === "final") patch(id, { final: ev, content: ev.answer, streaming: false });
        else patch(id, { error: ev.message, streaming: false });
      });
    } catch (err) {
      patch(id, { error: err instanceof Error ? err.message : "Something went wrong.", streaming: false });
    } finally {
      patch(id, { streaming: false });
      setBusy(false);
    }
  }

  async function feedback(m: UiMessage, value: 1 | -1) {
    if (!m.final) return;
    patch(m.id, { feedback: value });
    if (!(await sendFeedback(m.final.requestId, value))) patch(m.id, { feedback: undefined });
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col px-4 pb-6 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Policy Assistant</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl">Ask about Virginia AI policy</h1>
        </div>
        <div className="card flex gap-3 p-3">
          <label className="grid gap-1 text-xs font-medium text-ink-500">Agency (simulated tag)
            <select value={agency} onChange={(e) => setAgency(e.target.value)} className="field">
              {agencies.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-ink-500">Use case
            <select value={useCase} onChange={(e) => setUseCase(e.target.value)} className="field">
              {useCases.map((u) => <option key={u.code} value={u.code}>{u.name}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="mt-8 flex-1 space-y-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="fade-up">
            <div className="card relative overflow-hidden p-6 sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />
              <h2 className="text-lg font-semibold text-ink-900">What would you like to know?</h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-600">
                Answers come only from the loaded public documents, and every claim is cited. If the documents don&rsquo;t cover a question, the assistant says so instead of guessing.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {STARTERS.map(({ text, Icon }) => (
                  <li key={text}>
                    <button onClick={() => ask(text)} disabled={busy}
                      className="card-hover group flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white p-3.5 text-left">
                      <span className="icon-tile !h-9 !w-9 !rounded-lg"><Icon size={16} aria-hidden /></span>
                      <span className="flex-1 text-sm font-medium text-ink-800">{text}</span>
                      <ArrowUpRight size={16} className="shrink-0 text-ink-300 transition group-hover:text-brand-600" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {messages.map((m) => <MessageView key={m.id} message={m} onCite={setSource} onFeedback={feedback} />)}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="sticky bottom-3 mt-6">
        <div className="card flex items-center gap-2 p-2 pl-5 shadow-lg ring-1 ring-brand-100 focus-within:ring-2 focus-within:ring-brand-400">
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Ask a policy question" aria-label="Your question"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-ink-900 outline-none placeholder:text-ink-400" />
          <button disabled={busy || !input.trim()} aria-label="Send question" className="btn btn-primary !h-10 !w-10 !p-0">
            <ArrowUp size={18} aria-hidden />
          </button>
        </div>
        <p className="mt-2.5 text-center text-xs text-ink-500">
          Documents last ingested: {lastIngested ?? "unknown"} &middot; AI can make mistakes, so check important answers against the cited source.
        </p>
      </form>

      {source && <SourcePanel source={source} onClose={() => setSource(null)} />}
    </div>
  );
}
