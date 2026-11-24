import "server-only";
import { getSupabase } from "@/lib/db/supabase";
import { embed, type CallMeta } from "@/lib/llm";
import { computeCost } from "@/lib/metering/cost";
import { embeddingText } from "./embedtext";

export interface StorableChunk { index: number; page: number | null; content: string; tokenCount: number }

const EMBED_BATCH = 64;
const INSERT_BATCH = 100;

/**
 * Shared by policy and about ingestion: embed every chunk, THEN replace the stored
 * chunks, THEN save the file hash. Embedding first means a failure can't leave a
 * half-loaded document; saving the hash last means a failed run is retried next time.
 */
export async function replaceChunks(a: {
  documentId: string;
  corpus: "policy" | "about";
  chunks: StorableChunk[];
  hash: string;
  pageCount: number | null;
  embedTitle?: string; // document title, put in front of each chunk before embedding
  meta: CallMeta;
}): Promise<{ tokens: number; costUsd: number }> {
  const db = getSupabase();
  const vectors: number[][] = [];
  let model = "";
  let tokens = 0;
  let costUsd = 0;
  for (let i = 0; i < a.chunks.length; i += EMBED_BATCH) {
    // Embed "title + chunk" (see embedtext.ts); the stored and displayed text stays the plain chunk.
    const res = await embed(a.chunks.slice(i, i + EMBED_BATCH).map((c) => embeddingText(a.embedTitle, c.content)), a.meta);
    vectors.push(...res.vectors);
    model = res.model; // pricing key, e.g. "openai:text-embedding-3-small"
    tokens += res.usage.inputTokens;
    costUsd += computeCost(res.usage, res.model);
  }

  const del = await db.from("chunks").delete().eq("document_id", a.documentId);
  if (del.error) throw new Error(`deleting old chunks failed: ${del.error.message}`);

  for (let i = 0; i < a.chunks.length; i += INSERT_BATCH) {
    const rows = a.chunks.slice(i, i + INSERT_BATCH).map((c, j) => ({
      document_id: a.documentId, corpus: a.corpus, chunk_index: c.index, page: c.page, content: c.content,
      token_count: c.tokenCount, embedding: JSON.stringify(vectors[i + j]), embedding_model: model,
    }));
    const ins = await db.from("chunks").insert(rows);
    if (ins.error) throw new Error(`inserting chunks failed: ${ins.error.message}`);
  }

  const upd = await db.from("documents").update({ file_hash: a.hash, page_count: a.pageCount, ingested_at: new Date().toISOString() }).eq("id", a.documentId);
  if (upd.error) throw new Error(`document update failed: ${upd.error.message}`);
  return { tokens, costUsd };
}
