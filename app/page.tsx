import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowRight, BarChart3, FlaskConical, MessagesSquare } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { formatCost } from "@/lib/format";
import { getSiteStats } from "@/lib/site/stats";

// Rebuilt at most once a minute, so the live numbers are fresh without a query per visitor.
export const revalidate = 60;

function Card({ href, Icon, title, text, stat, statLabel }: { href: string; Icon: typeof BarChart3; title: string; text: string; stat: string; statLabel: string }) {
  return (
    <Link href={href} className="group flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md">
      <Icon size={22} aria-hidden className="text-neutral-700" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-neutral-600">{text}</p>
      <p className="mt-4 text-2xl font-semibold">{stat}</p>
      <p className="text-xs text-neutral-500">{statLabel}</p>
      <span className="mt-3 flex items-center gap-1 text-sm font-medium">Open <ArrowRight size={14} aria-hidden className="transition group-hover:translate-x-0.5" /></span>
    </Link>
  );
}

export default async function Home() {
  const stats = await getSiteStats();
  const mapping = fs.readFileSync(path.join(process.cwd(), "content", "about-kb", "jd-mapping.md"), "utf8");
  const links = [
    { label: "LinkedIn", href: process.env.NEXT_PUBLIC_LINKEDIN_URL },
    { label: "GitHub", href: process.env.NEXT_PUBLIC_GITHUB_URL },
  ].filter((l): l is { label: string; href: string } => !!l.href);

  return (
    <main className="mx-auto max-w-5xl space-y-12 px-4 py-12">
      <section>
        <h1 className="text-4xl font-semibold tracking-tight">PolicyMeter</h1>
        <p className="mt-3 max-w-2xl text-lg text-neutral-600">
          Cited answers about Virginia AI policy, with every model call metered by agency and use case, so you can trust the answer and see what it cost.
        </p>
        <p className="mt-2 text-sm text-neutral-500">An independent proof of concept by {process.env.NEXT_PUBLIC_BUILDER_NAME ?? "the builder"}. Public documents only.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="What is in the demo">
        <Card href="/chat" Icon={MessagesSquare} title="Policy Assistant" text="Ask a policy question. Every answer cites its source and says so when the documents don't cover it."
          stat={stats.documents == null ? "n/a" : String(stats.documents)} statLabel="policy documents loaded" />
        <Card href="/dashboard" Icon={BarChart3} title="Cost Dashboard" text="Spend by agency, use case and model, with budgets, alerts, a forecast and a model what-if."
          stat={stats.monthSpendUsd == null ? "n/a" : formatCost(stats.monthSpendUsd)} statLabel={`spent this month${stats.hasSimulated ? " (includes simulated traffic)" : ""}`} />
        <Card href="/evals" Icon={FlaskConical} title="Evals" text="A golden set scored for retrieval, citations, groundedness and correct refusals."
          stat={stats.groundedness == null ? "No runs yet" : `${stats.groundedness.toFixed(1)} / 5`} statLabel={stats.groundedness == null ? "groundedness, latest run" : `groundedness, latest run (${stats.evalQuestions} questions)`} />
      </section>

      <section aria-labelledby="role">
        <h2 id="role" className="text-2xl font-semibold">How this maps to the role</h2>
        <Markdown source={mapping} headingOffset={1} dropTitle />
      </section>

      <section className="flex flex-wrap items-center gap-4 border-t pt-6 text-sm">
        <Link href="/architecture" className="font-medium underline">Architecture and POC scorecard</Link>
        {links.map((l) => <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="underline">{l.label}</a>)}
        <span className="text-neutral-500">Use the &ldquo;Ask about this demo&rdquo; button to question the build.</span>
      </section>
    </main>
  );
}
