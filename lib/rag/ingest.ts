import "server-only";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { getSupabase } from "@/lib/db/supabase";
import { embed } from "@/lib/llm";
import { computeCost } from "@/lib/metering/cost";
import { chunkPages } from "./chunk";
import { stripRepeatedLines, thinPages } from "./clean";
import type { ManifestDoc } from "./manifest";
import { sourcePath } from "./manifest";
import { extractPages } from "./pdf";

export interface IngestResult {
  docId: string;
  outcome: "ingested" | "skipped" | "failed";
  pages: number;
  chunks: number;
  tokens: number;
  costUsd: number;
  warnings: string[];
}

const EMBED_BATCH = 64;
const INSERT_BATCH = 100;

/**
 * Load one document into the database. Unchanged files (same SHA-256) are
 * skipped, but the metadata (status, replaced_by...) is always refreshed, so a
 * status change in the manifest never costs an embedding call.
 */
export async function ingestDocument(doc: ManifestDoc): Promise<IngestResult> {
  const result: IngestResult = { docId: doc.doc_id, outcome: "failed", pages: 0, chunks: 0, tokens: 0, costUsd: 0, warnings: [] };
  const db = getSupabase();

  const buffer = fs.readFileSync(sourcePath(doc));
  const hash = createHash("sha256").update(buffer).digest("hex");

  const { data: row, error } = await db
    .from("documents")
    .upsert(
      {
        doc_id: doc.doc_id, corpus: "policy", title: doc.title, issuer: doc.issuer ?? null,
        published: doc.published ?? null, status: doc.status, replaced_by: doc.replaced_by ?? null, url: doc.url ?? null,
      },
      { onConflict: "doc_id" },
    )
    .select("id, file_hash, page_count")
    .single();
  if (error || !row) throw new Error(`documents upsert failed: ${error?.message}`);

  if (row.file_hash === hash) {
    const { count } = await db.from("chunks").select("id", { count: "exact", head: true }).eq("document_id", row.id);
    if (count) return { ...result, outcome: "skipped", pages: row.page_count ?? 0, chunks: count };
  }

  const rawPages = await extractPages(buffer);
  const pages = stripRepeatedLines(rawPages);
  result.pages = pages.length;
  const thin = thinPages(pages);
  if (thin.length) {
    result.warnings.push(`${thin.length}/${pages.length} pages have under 200 characters of text (scanned?): ${thin.slice(0, 10).join(", ")}${thin.length > 10 ? "..." : ""}`);
  }

  const chunks = chunkPages(pages);
  if (!chunks.length) {
    result.warnings.push("No text could be extracted. Re-download a text version of this PDF (no OCR in this demo).");
    return result;
  }

  // Embed everything BEFORE touching the stored chunks, so a failure can't leave a half-loaded document.
  const meta = { requestId: randomUUID(), agency: "VITA", useCase: "ingestion" };
  const vectors: number[][] = [];
  let model = "";
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const res = await embed(chunks.slice(i, i + EMBED_BATCH).map((c) => c.content), meta);
    vectors.push(...res.vectors);
    model = res.model; // pricing key, e.g. "openai:text-embedding-3-small"
    result.tokens += res.usage.inputTokens;
    result.costUsd += computeCost(res.usage, res.model);
  }

  const del = await db.from("chunks").delete().eq("document_id", row.id);
  if (del.error) throw new Error(`deleting old chunks failed: ${del.error.message}`);

  for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
    const rows = chunks.slice(i, i + INSERT_BATCH).map((c, j) => ({
      document_id: row.id, corpus: "policy", chunk_index: c.index, page: c.page, content: c.content,
      token_count: c.tokenCount, embedding: JSON.stringify(vectors[i + j]), embedding_model: model,
    }));
    const ins = await db.from("chunks").insert(rows);
    if (ins.error) throw new Error(`inserting chunks failed: ${ins.error.message}`);
  }

  // The hash is saved last: if anything above failed, the next run re-ingests.
  const upd = await db.from("documents").update({ file_hash: hash, page_count: pages.length, ingested_at: new Date().toISOString() }).eq("id", row.id);
  if (upd.error) throw new Error(`document update failed: ${upd.error.message}`);

  return { ...result, outcome: "ingested", chunks: chunks.length };
}
