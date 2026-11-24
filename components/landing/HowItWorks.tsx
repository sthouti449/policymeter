import { FileSearch, Gauge, MessageSquare, ShieldCheck } from "lucide-react";

const STEPS = [
  { Icon: MessageSquare, title: "Ask", text: "Pick an agency and a use case, then ask in plain language." },
  { Icon: ShieldCheck, title: "Check", text: "Input checks, rate limits and spend caps run before any model is called." },
  { Icon: FileSearch, title: "Retrieve and cite", text: "Hybrid search finds the passages. The answer cites every claim, or refuses." },
  { Icon: Gauge, title: "Meter", text: "Tokens, cost, agency and use case are logged for every single call." },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how" className="mx-auto max-w-7xl px-4 py-16">
      <p className="eyebrow">How it works</p>
      <h2 id="how" className="mt-2 max-w-2xl text-3xl font-semibold text-ink-900">One question, four safeguards</h2>
      <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ Icon, title, text }, i) => (
          <li key={title} className="card relative p-5">
            <span className="absolute right-4 top-4 text-3xl font-semibold text-ink-100" aria-hidden>{i + 1}</span>
            <span className="icon-tile"><Icon size={20} aria-hidden /></span>
            <h3 className="mt-4 text-base font-semibold text-ink-900">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
