import "./_env";
import { getEnv } from "@/lib/env";
import { retrieve } from "@/lib/rag/retrieve";

// Usage: npm run try-retrieve -- "Is Executive Order 30 still in effect?"
async function main() {
  getEnv();
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) throw new Error('Usage: npm run try-retrieve -- "your question"');

  const meta = { requestId: crypto.randomUUID(), agency: "VITA", useCase: "policy-qa" };
  const r = await retrieve(question, "policy", meta);

  console.log(`\nQ: ${question}`);
  console.log(`Top similarity: ${r.topSimilarity.toFixed(3)}   (refusal threshold is applied in Stage 3)\n`);
  r.chunks.forEach((c, i) => {
    const preview = c.content.replace(/\s+/g, " ").slice(0, 140);
    console.log(`[${i + 1}] ${c.title} | p.${c.page ?? "-"} | ${c.status} | sim ${c.similarity.toFixed(3)}\n    ${preview}...`);
  });
  if (!r.chunks.length) console.log("No chunks found. Has `npm run ingest` run?");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
