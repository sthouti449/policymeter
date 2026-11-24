import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowRight, BarChart3, FlaskConical, MessagesSquare } from "lucide-react";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Role } from "@/components/landing/Role";
import { formatCost } from "@/lib/format";
import { getSiteStats } from "@/lib/site/stats";

// Rebuilt at most once a minute, so the live numbers are fresh without a query per visitor.
export const revalidate = 60;

interface FeatureProps { href: string; Icon: typeof BarChart3; title: string; text: string; stat: string; statLabel: string }

function Feature({ href, Icon, title, text, stat, statLabel }: FeatureProps) {
  return (
    <Link href={href} className="card card-hover group flex flex-col p-6">
      <span className="icon-tile"><Icon size={20} aria-hidden /></span>
      <h3 className="mt-4 text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-600">{text}</p>
      <div className="mt-5 flex items-end justify-between border-t border-ink-100 pt-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-ink-900">{stat}</p>
          <p className="text-xs text-ink-500">{statLabel}</p>
        </div>
        <span className="flex items-center gap-1 text-sm font-semibold text-brand-700">
          Open <ArrowRight size={15} aria-hidden className="transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export default async function Home() {
  const stats = await getSiteStats();
  const mapping = fs.readFileSync(path.join(process.cwd(), "content", "about-kb", "jd-mapping.md"), "utf8");

  return (
    <main>
      <Hero />

      <section aria-label="What is in the demo" className="mx-auto max-w-7xl px-4">
        <div className="grid gap-5 md:grid-cols-3">
          <Feature href="/chat" Icon={MessagesSquare} title="Policy Assistant"
            text="Ask a policy question. Every answer cites its source, and it says so when the documents don't cover it."
            stat={stats.documents == null ? "n/a" : String(stats.documents)} statLabel="policy documents loaded" />
          <Feature href="/dashboard" Icon={BarChart3} title="Cost Dashboard"
            text="Spend by agency, use case and model, with budgets, alerts, a forecast and a model what-if."
            stat={stats.monthSpendUsd == null ? "n/a" : formatCost(stats.monthSpendUsd)}
            statLabel={`spent this month${stats.hasSimulated ? " (includes simulated traffic)" : ""}`} />
          <Feature href="/evals" Icon={FlaskConical} title="Evals"
            text="A golden set scored for retrieval, citations, groundedness and correct refusals."
            stat={stats.groundedness == null ? "No runs yet" : `${stats.groundedness.toFixed(1)} / 5`}
            statLabel={stats.groundedness == null ? "groundedness, latest run" : `groundedness, latest run (${stats.evalQuestions} questions)`} />
        </div>
      </section>

      <HowItWorks />
      <Role source={mapping} />

      <section className="mx-auto max-w-7xl px-4 pb-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0e2a30] via-brand-900 to-brand-700 px-6 py-12 text-center sm:px-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" aria-hidden />
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">See how it holds up</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            The targets were set before the build. The scorecard, the architecture and the production path are all on the record.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/evals" className="btn btn-light">See the eval results</Link>
            <Link href="/architecture" className="btn border border-white/30 text-white hover:bg-white/10">Read the architecture</Link>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-ink-500">
          Questions about the build? Use the <strong className="font-semibold text-ink-700">Ask about this demo</strong> button in the corner.
        </p>
      </section>
    </main>
  );
}
