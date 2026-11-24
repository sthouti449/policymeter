import "server-only";
import { getSupabase } from "@/lib/db/supabase";
import { getEnv } from "@/lib/env";
import { embed, type CallMeta } from "@/lib/llm";
import { computeCost } from "@/lib/metering/cost";
import { rrf } from "./fuse";

export interface RetrievedChunk {
  chunkId: number;
  content: string;
  page: number | null;
  similarity: number; // cosine similarity to the question, 0..1
  docId: string;
  title: string;
  status: "current" | "rescinded" | "historical";
  replacedBy: string | null;
  url: string | null;
}

export interface Retrieval {
  chunks: RetrievedChunk[]; // best first, at most RAG_MATCH_COUNT
  topSimilarity: number; // highest cosine similarity among ALL candidates
  embedCostUsd: number; // what the question embedding cost, same math as the llm_calls row
}

type Row = {
  chunk_id: number; content: string; page: number | null; similarity: number;
  doc_id: string; title: string; status: RetrievedChunk["status"]; replaced_by: string | null; url: string | null;
};
const toChunk = (r: Row): RetrievedChunk => ({
  chunkId: r.chunk_id, content: r.content, page: r.page, similarity: r.similarity,
  docId: r.doc_id, title: r.title, status: r.status, replacedBy: r.replaced_by, url: r.url,
});

const CANDIDATES = 20; // fetched from each search before fusing down to RAG_MATCH_COUNT
let checkedModel: string | undefined;

/** Query and chunks must use the SAME embedding model, or similarity scores are meaningless. */
async function assertSameEmbeddingModel(corpus: string, model: string) {
  if (checkedModel === `${corpus}:${model}`) return;
  const { data, error } = await getSupabase()
    .from("chunks").select("embedding_model").eq("corpus", corpus).neq("embedding_model", model).limit(1);
  if (error) throw new Error(`embedding model check failed: ${error.message}`);
  if (data?.length) {
    throw new Error(
      `Chunks were embedded with "${data[0].embedding_model}" but the app is configured for "${model}". Re-ingest all documents or fix the embedding settings.`,
    );
  }
  checkedModel = `${corpus}:${model}`;
}

/**
 * Embed the question, then search. With RAG_HYBRID the vector and keyword rankings
 * are merged with reciprocal rank fusion. Returns chunks WITH similarity and does
 * NOT apply the refusal threshold: the caller (Stage 3) decides, because the
 * threshold is tuned on the golden set.
 */
export async function retrieve(question: string, corpus: "policy" | "about", meta: CallMeta): Promise<Retrieval> {
  const { env } = getEnv();
  const db = getSupabase();
  const emb = await embed([question], { ...meta, question });
  await assertSameEmbeddingModel(corpus, emb.model);
  const vector = emb.vectors[0];

  // min_similarity 0: we want the true top similarity even when it is low.
  const { data: vecRows, error } = await db.rpc("match_chunks", {
    query_embedding: vector, match_corpus: corpus, match_count: CANDIDATES, min_similarity: 0,
  });
  if (error) throw new Error(`match_chunks failed: ${error.message}`);
  const found = new Map<number, RetrievedChunk>((vecRows as Row[]).map((r) => [r.chunk_id, toChunk(r)]));
  const vectorIds = [...found.keys()];
  const topSimilarity = vectorIds.length ? Math.max(...[...found.values()].map((c) => c.similarity)) : 0;

  let order = vectorIds;
  if (env.RAG_HYBRID === "true") {
    const { data: kwRows, error: kwErr } = await db.rpc("keyword_chunks", {
      query_text: question, match_corpus: corpus, match_count: CANDIDATES,
    });
    if (kwErr) throw new Error(`keyword_chunks failed: ${kwErr.message}`);
    const kwIds = (kwRows as { chunk_id: number }[]).map((r) => r.chunk_id);
    order = rrf([vectorIds, kwIds]).slice(0, env.RAG_MATCH_COUNT);

    const missing = order.filter((id) => !found.has(id)); // keyword-only hits
    if (missing.length) {
      const { data, error: idErr } = await db.rpc("chunks_by_id", { query_embedding: vector, chunk_ids: missing });
      if (idErr) throw new Error(`chunks_by_id failed: ${idErr.message}`);
      for (const r of data as Row[]) found.set(r.chunk_id, toChunk(r));
    }
  }

  const chunks = order.slice(0, env.RAG_MATCH_COUNT).flatMap((id) => (found.has(id) ? [found.get(id)!] : []));
  return { chunks, topSimilarity, embedCostUsd: computeCost(emb.usage, emb.model) };
}
