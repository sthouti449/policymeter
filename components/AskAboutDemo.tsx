"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, Send, X } from "lucide-react";
import { DEMO_STARTERS, type DemoReply } from "@/lib/chat/demo";
import { DISCLAIMER } from "@/lib/chat/client";
import { CostChip } from "@/components/chat/CostChip";

interface Turn { id: string; question: string; reply?: DemoReply; error?: string }

/**
 * Floating "Ask about this demo" assistant, mounted once in the root layout so it
 * appears on every page. Answers come from /api/ask-demo (about-kb only).
 * Keyboard: Esc closes, focus moves to the input on open and back to the button on close.
 */
export function AskAboutDemo() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) field.current?.focus(); }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  const close = () => { setOpen(false); button.current?.focus(); };

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const id = crypto.randomUUID();
    setTurns((t) => [...t, { id, question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ask-demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, reply: body as DemoReply } : x)));
    } catch (err) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: err instanceof Error ? err.message : "Something went wrong." } : x)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button ref={button} onClick={() => setOpen(true)} aria-label="Ask about this demo"
          className="btn btn-primary fixed bottom-24 right-4 z-40 !px-4 !py-3 shadow-xl shadow-brand-700/25 sm:bottom-5 sm:right-5">
          <MessageCircleQuestion size={18} aria-hidden />
          <span className="hidden sm:inline">Ask about this demo</span>
        </button>
      )}

      {open && (
        <section role="dialog" aria-label="Ask about this demo" onKeyDown={(e) => e.key === "Escape" && close()}
          className="card fixed inset-x-2 bottom-2 z-40 flex max-h-[80vh] flex-col overflow-hidden shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[24rem]">
          <header className="flex items-center justify-between bg-gradient-to-br from-brand-700 to-[#0e2a30] px-4 py-3.5 text-white">
            <div>
              <h2 className="font-semibold">Ask about this demo</h2>
              <p className="text-xs text-white/75">Architecture, cost metering and the builder&rsquo;s background.</p>
            </div>
            <button onClick={close} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15"><X size={18} aria-hidden /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
            {turns.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {DEMO_STARTERS.map((q) => (
                  <button key={q} onClick={() => ask(q)} className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-ink-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800">{q}</button>
                ))}
              </div>
            )}
            {turns.map((t) => (
              <div key={t.id} className="space-y-2">
                <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-brand-700 px-3.5 py-2 text-white shadow-sm">{t.question}</p>
                {t.error ? (
                  <p role="alert" className="text-red-700">{t.error}</p>
                ) : t.reply ? (
                  <div className="space-y-2 rounded-2xl rounded-tl-md border border-ink-200 bg-ink-50/70 p-3.5">
                    <p className="whitespace-pre-wrap leading-relaxed text-ink-800">{t.reply.answer}</p>
                    {t.reply.sources.length > 0 && <p className="text-xs text-ink-500">From: {t.reply.sources.join("; ")}</p>}
                    <p className="text-[11px] text-ink-500">{DISCLAIMER}</p>
                    <CostChip cost={t.reply.cost} />
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-ink-500" role="status"><span className="flex gap-1" aria-hidden><span className="dot" /><span className="dot" /><span className="dot" /></span>Thinking&hellip;</p>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="flex gap-2 border-t border-ink-100 p-3">
            <input ref={field} value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Ask about the build" aria-label="Your question"
              className="field min-w-0 flex-1 !rounded-full !px-4 !py-2" />
            <button disabled={busy || !input.trim()} aria-label="Send" className="btn btn-primary !h-10 !w-10 !p-0"><Send size={16} aria-hidden /></button>
          </form>
        </section>
      )}
    </>
  );
}
