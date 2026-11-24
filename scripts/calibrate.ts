import "./_env";
import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";
import { loadGoldenSet } from "@/lib/evals/golden";
import { retrieve } from "@/lib/rag/retrieve";

// Usage: npm run calibrate
// Picks the similarity cutoff (RAG_MIN_SIMILARITY) from data instead of a guess. For every golden-set
// question it measures the best similarity retrieval finds (embedding only: a few thousandths of a cent
// per question, no chat call). A good cutoff sits between the OUT-of-scope questions (which must be
// refused) and the in-scope questions (which must be answered).
async function main() {
  const { env } = getEnv();
  const golden = loadGoldenSet();
  const rows = [];
  for (const g of golden) {
    const r = await retrieve(g.question, "policy", { requestId: randomUUID(), agency: "VITA", useCase: "eval-run" });
    const found = new Set(r.chunks.map((c) => c.docId));
    rows.push({
      id: g.id, kind: g.should_refuse ? "out-of-scope" : "in-scope", top: r.topSimilarity,
      // only meaningful for in-scope questions whose document is actually loaded
      expectedFound: g.should_refuse ? null : g.expected_doc_ids.some((d) => found.has(d)),
    });
  }
  console.table(rows.map((r) => ({ question: r.id, kind: r.kind, "top similarity": r.top.toFixed(3), "expected doc found": r.expectedFound ?? "-" })));

  const outMax = Math.max(...rows.filter((r) => r.kind === "out-of-scope").map((r) => r.top));
  const goodIn = rows.filter((r) => r.kind === "in-scope" && r.expectedFound).map((r) => r.top);
  const inMin = Math.min(...goodIn);
  console.log(`\nHighest out-of-scope similarity (must be refused): ${outMax.toFixed(3)}`);
  console.log(`Lowest in-scope similarity where the right document was found (${goodIn.length} questions): ${inMin.toFixed(3)}`);
  console.log(`Current cutoff RAG_MIN_SIMILARITY: ${env.RAG_MIN_SIMILARITY}`);
  if (inMin > outMax) {
    const mid = (outMax + inMin) / 2;
    // Stay nearer the out-of-scope side: a false answer is worse than one extra refusal, but leave headroom.
    const suggested = Math.round((outMax + (inMin - outMax) * 0.4) * 100) / 100;
    console.log(`The two groups are separated by ${(inMin - outMax).toFixed(3)}. Midpoint ${mid.toFixed(3)}; suggested cutoff ${suggested.toFixed(2)}.`);
    console.log(`Set RAG_MIN_SIMILARITY=${suggested.toFixed(2)} in .env.local (and in Vercel), then run npm run eval.`);
  } else {
    console.log("The groups OVERLAP, so no single cutoff separates them. Improve retrieval or rely on the model's own refusal for the overlap.");
  }
  console.log("Caution: 16 questions is a small sample. Keep headroom, and re-run this after adding documents.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
