import "server-only";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getSupabase } from "@/lib/db/supabase";
import type { IngestResult } from "./ingest";
import { chunkMarkdown } from "./markdown";
import { replaceChunks } from "./store";

export const ABOUT_DIR = path.join(process.cwd(), "content", "about-kb");

/**
 * Load one about-kb markdown file (corpus 'about'). Metered as agency DEMO, use
 * case 'ingestion'. HTML comments are stripped first, so the "EDIT BEFORE
 * DEPLOYING" notes can never be retrieved or quoted by the reviewer bot.
 */
export async function ingestAboutFile(file: string): Promise<IngestResult> {
  const result: IngestResult = { docId: `about-${file.replace(/\.md$/, "")}`, outcome: "failed", pages: 0, chunks: 0, tokens: 0, costUsd: 0, warnings: [] };
  const raw = fs.readFileSync(path.join(ABOUT_DIR, file), "utf8");
  const hash = createHash("sha256").update(raw).digest("hex");
  const { title, chunks } = chunkMarkdown(raw, file);
  if (!chunks.length) {
    result.warnings.push("File has no text after removing comments.");
    return result;
  }

  const db = getSupabase();
  const { data: row, error } = await db
    .from("documents")
    .upsert({ doc_id: result.docId, corpus: "about", title, issuer: null, status: "current" }, { onConflict: "doc_id" })
    .select("id, file_hash")
    .single();
  if (error || !row) throw new Error(`documents upsert failed: ${error?.message}`);

  if (row.file_hash === hash) {
    const { count } = await db.from("chunks").select("id", { count: "exact", head: true }).eq("document_id", row.id);
    if (count) return { ...result, outcome: "skipped", chunks: count };
  }

  const stored = await replaceChunks({
    documentId: row.id, corpus: "about", hash, pageCount: null,
    chunks: chunks.map((c, i) => ({ index: i, page: null, content: c.content, tokenCount: c.tokenCount })),
    meta: { requestId: randomUUID(), agency: "DEMO", useCase: "ingestion" },
  });
  return { ...result, outcome: "ingested", chunks: chunks.length, tokens: stored.tokens, costUsd: stored.costUsd };
}

export const listAboutFiles = () => fs.readdirSync(ABOUT_DIR).filter((f) => f.endsWith(".md")).sort();
