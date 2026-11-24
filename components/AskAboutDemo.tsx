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
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [turns]);

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
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-black px-4 py-3 text-sm text-white shadow-lg hover:bg-neutral-800 sm:bottom-4">
          <MessageCircleQuestion size={18} aria-hidden />
          <span className="hidden sm:inline">Ask about this demo</span>
        </button>
      )}

      {open && (
        <section role="dialog" aria-label="Ask about this demo" onKeyDown={(e) => e.key === "Escape" && close()}
          className="fixed inset-x-2 bottom-2 z-40 flex max-h-[80vh] flex-col rounded-2xl border bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[24rem]">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="font-semibold">Ask about this demo</h2>
              <p className="text-xs text-neutral-500">Architecture, cost metering and the builder&rsquo;s background.</p>
            </div>
            <button onClick={close} aria-label="Close" className="rounded p-1 hover:bg-neutral-100"><X size={18} aria-hidden /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
            {turns.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {DEMO_STARTERS.map((q) => (
                  <button key={q} onClick={() => ask(q)} className="rounded-full border px-3 py-1.5 text-left text-xs hover:bg-neutral-50">{q}</button>
                ))}
              </div>
            )}
            {turns.map((t) => (
              <div key={t.id} className="space-y-2">
                <p className="ml-auto w-fit max-w-[90%] rounded-2xl bg-black px-3 py-1.5 text-white">{t.question}</p>
                {t.error ? (
                  <p role="alert" className="text-red-700">{t.error}</p>
                ) : t.reply ? (
                  <div className="space-y-2 rounded-2xl border p-3">
                    <p className="whitespace-pre-wrap leading-relaxed">{t.reply.answer}</p>
                    {t.reply.sources.length > 0 && <p className="text-xs text-neutral-500">From: {t.reply.sources.join("; ")}</p>}
                    <p className="text-xs text-neutral-500">{DISCLAIMER}</p>
                    <CostChip cost={t.reply.cost} />
                  </div>
                ) : (
                  <p className="text-neutral-500">Thinking&hellip;</p>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="flex gap-2 border-t p-3">
            <input ref={field} value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Ask about the build" aria-label="Your question"
              className="min-w-0 flex-1 rounded-full border px-3 py-2 text-sm" />
            <button disabled={busy || !input.trim()} aria-label="Send" className="rounded-full bg-black p-2.5 text-white disabled:opacity-40"><Send size={16} aria-hidden /></button>
          </form>
        </section>
      )}
    </>
  );
}
