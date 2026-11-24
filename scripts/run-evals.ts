import "./_env";
import { getEnv } from "@/lib/env";
import { runEvals } from "@/lib/evals/run";

// Usage: npm run eval                       (the whole golden set)
//        npm run eval -- q03-eo30-status    (only these question ids)
// Spends real money: each question is one pipeline run plus one judge call.
async function main() {
  getEnv();
  const only = process.argv.slice(2);
  console.log(`Running ${only.length ? only.join(", ") : "the full golden set"} ...`);
  const { runId, summary, targets, items } = await runEvals({ only });

  console.log("\nScorecard (targets from docs/PRD.md section 4)");
  console.table(targets.map((t) => ({ criterion: t.label, target: t.target, result: t.value, pass: t.pass == null ? "n/a" : t.pass ? "PASS" : "FAIL" })));

  const bad = items.filter((i) => i.misses.length || (i.shouldRefuse && !i.refused) || (!i.shouldRefuse && (i.refused || !i.hit || !i.cited)) || (i.groundedness != null && i.groundedness < 4));
  if (bad.length) {
    console.log("\nQuestions that need a look");
    console.table(bad.map((i) => ({
      id: i.questionId, refused: i.refused, hit: i.hit, cited: i.cited, grounded: i.groundedness ?? "-",
      "missing phrases": i.misses.join(" | ") || "-", judge: (i.judgeReason ?? "").slice(0, 70),
    })));
  }
  console.log(`\nTotal eval cost: $${summary.totalCostUsd.toFixed(4)}   false refusals: ${summary.falseRefusals}   judge failures: ${summary.judgeFailures}`);
  console.log(`Saved as run ${runId}. See it at /evals.`);
  if (targets.some((t) => t.pass === false)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
