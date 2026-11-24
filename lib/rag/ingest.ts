import "server-only";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { getSupabase } from "@/lib/db/supabase";
import { chunkPages } from "./chunk";
import { stripRepeatedLines, thinPages } from "./clean";
import type { ManifestDoc } from "./manifest";
import { sourcePath } from "./manifest";
import { extractPages } from "./pdf";
import { replaceChunks } from "./store";

export interface IngestResult {
  docId: string;
  outcome: "ingested" | "skipped" | "failed";
  pages: number;
  chunks: number;
  tokens: number;
  costUsd: number;
  warnings: string[];
}

/**
 * Load one policy PDF into the database. Unchanged files (same SHA-256) are
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

  const pages = stripRepeatedLines(await extractPages(buffer));
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

  const stored = await replaceChunks({
    documentId: row.id, corpus: "policy", chunks, hash, pageCount: pages.length,
    meta: { requestId: randomUUID(), agency: "VITA", useCase: "ingestion" },
  });
  return { ...result, outcome: "ingested", chunks: chunks.length, tokens: stored.tokens, costUsd: stored.costUsd };
}
