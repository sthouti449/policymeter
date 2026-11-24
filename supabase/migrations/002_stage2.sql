-- Stage 2 migration. Run once in Supabase -> SQL Editor. Safe to run twice.
-- (Also added to schema.sql for fresh installs.)

-- Hybrid search merges vector hits and keyword hits. A chunk found only by keyword
-- search has no similarity score yet, so this fetches chunks by id WITH their cosine
-- similarity to the question. It lets the app apply one refusal threshold to all hits.
create or replace function chunks_by_id(
  query_embedding vector(1536),
  chunk_ids       bigint[]
)
returns table (
  chunk_id     bigint,
  content      text,
  page         int,
  similarity   float,
  doc_id       text,
  title        text,
  status       text,
  replaced_by  text,
  url          text
)
language sql stable as $$
  select c.id, c.content, c.page,
         1 - (c.embedding <=> query_embedding) as similarity,
         d.doc_id, d.title, d.status, d.replaced_by, d.url
  from chunks c
  join documents d on d.id = c.document_id
  where c.id = any(chunk_ids);
$$;
