import "./_env";
import { getEnv } from "@/lib/env";
import type { IngestResult } from "@/lib/rag/ingest";
import { ingestAboutFile, listAboutFiles } from "@/lib/rag/ingest-about";

// Usage: npm run ingest:about
// Loads content/about-kb/*.md for the "Ask about this demo" widget (corpus 'about').
async function main() {
  getEnv();
  const results: IngestResult[] = [];
  for (const file of listAboutFiles()) {
    process.stdout.write(`${file} ... `);
    try {
      const r = await ingestAboutFile(file);
      results.push(r);
      console.log(r.outcome);
      for (const w of r.warnings) console.warn(`  WARNING: ${w}`);
    } catch (err) {
      console.log("failed");
      console.error(`  ${err instanceof Error ? err.message : err}`);
      results.push({ docId: file, outcome: "failed", pages: 0, chunks: 0, tokens: 0, costUsd: 0, warnings: [] });
    }
  }
  console.log();
  console.table(results.map((r) => ({ document: r.docId, result: r.outcome, chunks: r.chunks, "embed tokens": r.tokens, "embed cost (USD)": r.costUsd.toFixed(6) })));
  if (results.some((r) => r.outcome === "failed")) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
