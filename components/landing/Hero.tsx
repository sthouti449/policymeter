import Link from "next/link";
import { ArrowRight, Check, Gauge, ShieldAlert } from "lucide-react";

const TRUST = ["Every answer cited", "Rescinded policy flagged", "Every call metered"];

const Cite = ({ n }: { n: number }) => (
  <sup className="ml-1 rounded bg-brand-100 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">{n}</sup>
);

/** A real answer from the live demo (shortened), so visitors see the product before they click anything. */
function ExampleCard() {
  return (
    <div className="card relative overflow-hidden p-5 sm:p-6" aria-label="Example answer from the live demo">
      <div className="mb-4 flex items-center justify-between">
        <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-mint-600" aria-hidden /> Example from the live demo</span>
        <span className="text-xs text-ink-500">Agency: DMV</span>
      </div>
      <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm">
        Is Executive Order 30 still in effect?
      </p>
      <div className="mt-3 rounded-2xl rounded-tl-md border border-ink-200 bg-ink-50/70 p-4">
        <p className="text-[15px] leading-relaxed text-ink-800">
          Executive Order 30 (Jan. 18, 2024) was rescinded by Executive Order 22 (2026)
          <Cite n={1} />. However, the policies, standards, and guidelines published pursuant to Executive Order 30 remain in effect unless or
          until they are replaced through a future executive or agency action
          <Cite n={1} />.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink-600">
          <ShieldAlert size={14} className="shrink-0 text-brand-600" aria-hidden />
          <span className="truncate"><strong className="font-semibold text-ink-800">Executive Order 22 (2026)</strong> &middot; p.9 &middot; current</span>
        </div>
        <p className="mt-3 text-[11px] text-ink-500">DISCLAIMER: This output was created with assistance from artificial intelligence.</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="chip font-mono"><Gauge size={12} aria-hidden /> $0.0001 &middot; 1.1 s &middot; Claude Haiku 5.5</span>
        <span className="text-xs text-ink-500">cost of the whole question, measured</span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
      <div className="fade-up">
        <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden /> Independent proof of concept &middot; public documents only</span>
        <h1 className="mt-5 text-4xl font-semibold leading-[1.08] text-ink-900 sm:text-5xl lg:text-[3.4rem]">
          AI answers you can trust,{" "}
          <span className="bg-gradient-to-r from-brand-500 to-brand-800 bg-clip-text text-transparent">with costs you can see.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
          Ask questions about Virginia AI policy and get cited answers. When the documents don&rsquo;t cover it, it says so. Every model call is metered by agency and use case.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/chat" className="btn btn-primary">Try the Policy Assistant <ArrowRight size={16} aria-hidden /></Link>
          <Link href="/dashboard" className="btn btn-secondary">View the cost dashboard</Link>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-600">
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-mint-100 text-mint-600"><Check size={13} strokeWidth={3} aria-hidden /></span>{t}
            </li>
          ))}
        </ul>
      </div>
      <div className="fade-up [animation-delay:120ms]"><ExampleCard /></div>
    </section>
  );
}
