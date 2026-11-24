import { z } from "zod";
import { RunEvalsButton } from "@/components/evals/RunEvalsButton";
import { ResultsTable } from "@/components/evals/ResultsTable";
import { RunTrend } from "@/components/evals/RunTrend";
import { Scorecard } from "@/components/evals/Scorecard";
import { checkTargets } from "@/lib/evals/score";
import { getResults, listRuns } from "@/lib/evals/store";
import type { ResultRow, RunRow, RunSummary } from "@/lib/evals/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evals" };

/** The stored run row has the headline numbers, which is all checkTargets needs. */
const summaryOf = (r: RunRow): RunSummary => ({
  questions: r.questions, inScope: 0, outOfScope: 0, retrievalHitRate: r.retrievalHitRate, citationRate: r.citationRate, groundednessAvg: r.groundednessAvg,
  refusalAccuracy: r.refusalAccuracy, falseRefusals: 0, mentionMisses: 0, judgeFailures: 0, p50TtftMs: r.p50TtftMs, p50LatencyMs: r.p50LatencyMs,
  totalCostUsd: r.totalCostUsd ?? 0, answeredCostUsd: r.answeredCostUsd,
});

export default async function EvalsPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run } = await searchParams;
  let runs: RunRow[] = [];
  let results: ResultRow[] = [];
  let loadError = false;
  try {
    runs = await listRuns(20);
    const wanted = z.string().uuid().safeParse(run).success ? runs.find((r) => r.id === run) : undefined;
    const selected = wanted ?? runs[0];
    if (selected) results = await getResults(selected.id);
  } catch (err) {
    console.error("evals page load failed:", err instanceof Error ? err.message : err);
    loadError = true;
  }
  const selected = runs.find((r) => r.id === run) ?? runs[0];

  return (
    <div className="viz-root min-h-screen">
      <main className="mx-auto max-w-6xl space-y-5 p-4 pt-8 md:p-6 md:pt-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Evals</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl">Measured against targets set before the build</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-ink-600">A golden set of 16 questions, scored for retrieval, citations, groundedness and refusals (see docs/PRD.md).</p>
          </div>
          <RunEvalsButton />
        </header>

        {loadError && <div role="alert" className="viz-card p-4 text-sm">The eval results could not be loaded right now.</div>}
        {!loadError && !selected && (
          <div className="viz-card p-6 text-sm">No eval runs yet. Run <code>npm run eval</code>, or enter the admin token above and press Run evals.</div>
        )}
        {selected && (
          <>
            <Scorecard targets={checkTargets(summaryOf(selected))} totalCostUsd={selected.totalCostUsd} questions={selected.questions} when={new Date(selected.createdAt).toLocaleString("en-US")} />
            {selected.notes && <p className="text-xs" style={{ color: "var(--viz-text-2)" }}>{selected.notes}</p>}
            <RunTrend runs={runs} selectedId={selected.id} />
            <ResultsTable rows={results} />
          </>
        )}
      </main>
    </div>
  );
}
