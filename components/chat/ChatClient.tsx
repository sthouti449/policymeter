"use client";
import { useEffect, useRef, useState } from "react";
import { sendFeedback, streamChat } from "@/lib/chat/client";
import type { Source } from "@/lib/chat/types";
import { MessageView, type UiMessage } from "./MessageView";
import { SourcePanel } from "./SourcePanel";

const STARTERS = [
  "What disclaimer must AI-generated outputs include?",
  "Do agencies have to register AI systems?",
  "Is Executive Order 30 still in effect?",
  "What does an Algorithmic Impact Assessment ask about?",
  "Which AI tools may agencies use?",
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

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

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

  const select = "rounded-lg border bg-white px-2 py-1.5 text-sm";
  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">Policy Assistant</h1>
        <div className="flex gap-3">
          <label className="grid text-xs text-neutral-500">Agency (simulated tag)
            <select value={agency} onChange={(e) => setAgency(e.target.value)} className={select}>
              {agencies.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
            </select>
          </label>
          <label className="grid text-xs text-neutral-500">Use case
            <select value={useCase} onChange={(e) => setUseCase(e.target.value)} className={select}>
              {useCases.map((u) => <option key={u.code} value={u.code}>{u.name}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="flex-1 space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3 pt-6">
            <p className="text-neutral-600">Ask about Virginia state AI policy. Every answer cites its source, and I say so when the documents don&rsquo;t cover a question.</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((q) => (
                <button key={q} onClick={() => ask(q)} className="rounded-full border bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => <MessageView key={m.id} message={m} onCite={setSource} onFeedback={feedback} />)}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="sticky bottom-0 space-y-1 bg-white/90 pb-2 backdrop-blur">
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Ask a policy question" aria-label="Your question"
            className="flex-1 rounded-full border px-4 py-2" />
          <button disabled={busy || !input.trim()} className="rounded-full bg-black px-5 py-2 text-white disabled:opacity-40">{busy ? "Working…" : "Ask"}</button>
        </div>
        <p className="text-xs text-neutral-500">Documents last ingested: {lastIngested ?? "unknown"}</p>
      </form>

      {source && <SourcePanel source={source} onClose={() => setSource(null)} />}
    </div>
  );
}
