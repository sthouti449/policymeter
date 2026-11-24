import "./_env";
import fs from "node:fs";
import { getEnv } from "@/lib/env";
import { ingestDocument, type IngestResult } from "@/lib/rag/ingest";
import { loadManifest, sourcePath } from "@/lib/rag/manifest";

// Usage: npm run ingest            (all documents)
//        npm run ingest -- eo22 ed6  (only these doc_ids)
//        npm run ingest -- --force   (re-embed everything, even unchanged files)
async function main() {
  getEnv(); // fail fast with a readable message if keys are missing
  const args = process.argv.slice(2);
  const force = args.includes("--force"); // re-embed even unchanged files (when the embedding method changed)
  const only = args.filter((a) => !a.startsWith("--"));
  const docs = loadManifest().filter((d) => !only.length || only.includes(d.doc_id));
  if (!docs.length) throw new Error(`No manifest documents match: ${only.join(", ")}`);

  // Check every file BEFORE spending anything. Optional files may be missing.
  const present = docs.filter((d) => fs.existsSync(sourcePath(d)));
  const missing = docs.filter((d) => !fs.existsSync(sourcePath(d)));
  const fatal = missing.filter((d) => !d.optional);
  if (fatal.length) {
    console.error(`Missing required files in data/sources/:\n${fatal.map((d) => `  - ${d.file}  (${d.doc_id})`).join("\n")}\nSee docs/DATA_SOURCES.md.`);
    process.exit(1);
  }
  for (const d of missing) console.warn(`Skipping optional document (file not found): ${d.file}`);

  const results: IngestResult[] = [];
  for (const doc of present) {
    process.stdout.write(`${doc.doc_id} ... `);
    try {
      const r = await ingestDocument(doc, { force });
      results.push(r);
      console.log(r.outcome);
      for (const w of r.warnings) console.warn(`  WARNING: ${w}`);
    } catch (err) {
      console.log("failed");
      console.error(`  ${err instanceof Error ? err.message : err}`);
      results.push({ docId: doc.doc_id, outcome: "failed", pages: 0, chunks: 0, tokens: 0, costUsd: 0, warnings: [] });
    }
  }

  console.log();
  console.table(
    results.map((r) => ({
      document: r.docId, result: r.outcome, pages: r.pages, chunks: r.chunks,
      "embed tokens": r.tokens, "embed cost (USD)": r.costUsd.toFixed(6),
    })),
  );
  console.log(`Total embedding cost: $${results.reduce((s, r) => s + r.costUsd, 0).toFixed(6)}`);
  if (results.some((r) => r.outcome === "failed")) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
