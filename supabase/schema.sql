-- PolicyMeter schema. Run once in Supabase → SQL Editor.
-- Embedding size 1536 matches text-embedding-3-small. If you use another
-- embedding model, change vector(1536) everywhere AND re-ingest.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------- Documents and chunks ----------
create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  doc_id        text not null unique,          -- from manifest, e.g. 'ea400'
  corpus        text not null check (corpus in ('policy','about')),
  title         text not null,
  issuer        text,
  published     date,
  status        text not null default 'current' check (status in ('current','rescinded','historical')),
  replaced_by   text,
  url           text,
  file_hash     text,
  page_count    int,
  ingested_at   timestamptz not null default now()
);

create table if not exists chunks (
  id               bigserial primary key,
  document_id      uuid not null references documents(id) on delete cascade,
  corpus           text not null check (corpus in ('policy','about')),
  chunk_index      int not null,
  page             int,
  content          text not null,
  token_count      int,
  embedding        vector(1536) not null,
  embedding_model  text not null,
  fts              tsvector generated always as (to_tsvector('english', content)) stored
);

create index if not exists chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index if not exists chunks_fts_idx on chunks using gin (fts);
create index if not exists chunks_corpus_idx on chunks (corpus);

-- Vector search. Returns document metadata so the app can build citations.
create or replace function match_chunks(
  query_embedding vector(1536),
  match_corpus    text,
  match_count     int default 6,
  min_similarity  float default 0.30
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
  where c.corpus = match_corpus
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Keyword search for hybrid retrieval (reciprocal rank fusion happens in app code).
create or replace function keyword_chunks(
  query_text   text,
  match_corpus text,
  match_count  int default 6
)
returns table (chunk_id bigint, rank float)
language sql stable as $$
  select c.id, ts_rank(c.fts, websearch_to_tsquery('english', query_text)) as rank
  from chunks c
  where c.corpus = match_corpus
    and c.fts @@ websearch_to_tsquery('english', query_text)
  order by rank desc
  limit match_count;
$$;

-- Fetch chunks by id with similarity (see supabase/migrations/002_stage2.sql).
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
language sql stable as $
  select c.id, c.content, c.page,
         1 - (c.embedding <=> query_embedding) as similarity,
         d.doc_id, d.title, d.status, d.replaced_by, d.url
  from chunks c
  join documents d on d.id = c.document_id
  where c.id = any(chunk_ids);
$;

-- ---------- Metering ----------
create table if not exists llm_calls (
  id                   bigserial primary key,
  request_id           uuid not null,
  created_at           timestamptz not null default now(),
  provider             text not null check (provider in ('azure','openai','anthropic')),
  model                text not null,            -- pricing key, e.g. base model name
  deployment           text,                     -- Azure deployment name, if any
  operation            text not null check (operation in ('chat','embed')),
  agency               text not null,
  use_case             text not null,
  input_tokens         int not null default 0,
  cached_input_tokens  int not null default 0,
  output_tokens        int not null default 0,
  cost_usd             numeric(12,8) not null default 0,
  latency_ms           int,
  ttft_ms              int,                      -- time to first token (streamed chats)
  status               text not null default 'ok' check (status in ('ok','error','refused','capped')),
  error_code           text,
  usage_estimated      boolean not null default false,
  simulated            boolean not null default false,
  question_redacted    text,                     -- max 500 chars, PII-redacted
  top_similarity       float,
  retrieved_chunk_ids  bigint[],
  feedback             smallint check (feedback in (-1, 1)),
  trace                jsonb                     -- retrieved chunks (title, page, status, similarity); no text
);

create index if not exists llm_calls_created_idx on llm_calls (created_at desc);
create index if not exists llm_calls_agency_idx on llm_calls (agency, created_at);
create index if not exists llm_calls_request_idx on llm_calls (request_id);

create table if not exists alerts (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  agency      text not null,                  -- 'GLOBAL' for the daily cap
  period      text not null,                  -- 'YYYY-MM' for budgets, 'YYYY-MM-DD' for daily cap
  level       text not null check (level in ('warning','breached','daily_cap')),
  spend_usd   numeric(12,6) not null,
  budget_usd  numeric(12,6) not null,
  message     text not null,
  webhook_ok  boolean,
  simulated   boolean not null default false, -- alerts caused by seeded traffic
  constraint alerts_unique_per_period unique (agency, period, level, simulated) -- fires once per period
);

-- Per-IP rate limiting (fixed one-minute windows). IPs are stored as SHA-256 hashes.
create table if not exists rate_limits (
  ip_hash      text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (ip_hash, window_start)
);

create or replace function hit_rate_limit(p_ip_hash text, p_limit int)
returns boolean                                  -- true = allowed
language plpgsql as $$
declare
  w timestamptz := date_trunc('minute', now());
  c int;
begin
  insert into rate_limits (ip_hash, window_start, count)
  values (p_ip_hash, w, 1)
  on conflict (ip_hash, window_start) do update set count = rate_limits.count + 1
  returning count into c;
  delete from rate_limits where window_start < now() - interval '1 hour';
  return c <= p_limit;
end;
$$;

-- ---------- Evals ----------
create table if not exists eval_runs (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  provider             text not null,
  model                text not null,
  questions            int not null,
  retrieval_hit_rate   float,
  citation_rate        float,
  groundedness_avg     float,
  refusal_accuracy     float,
  p50_latency_ms       int,
  total_cost_usd       numeric(12,6),
  notes                text
);

create table if not exists eval_results (
  id               bigserial primary key,
  run_id           uuid not null references eval_runs(id) on delete cascade,
  question_id      text not null,
  question         text not null,
  answer           text,
  expected_doc_ids text[],
  retrieved_doc_ids text[],
  hit              boolean,
  cited            boolean,
  groundedness     smallint,
  refused          boolean,
  should_refuse    boolean,
  judge_reason     text,
  latency_ms       int,
  cost_usd         numeric(12,8)
);

-- ---------- Spend helpers (see supabase/migrations/001_stage1.sql) ----------
create or replace function daily_spend(p_since timestamptz, p_scope text)
returns numeric language sql stable as $
  select coalesce(sum(cost_usd), 0) from llm_calls
  where created_at >= p_since and not simulated and use_case not in ('eval-run', 'ingestion')
    and ((p_scope = 'demo' and agency = 'DEMO') or (p_scope = 'global' and agency <> 'DEMO'));
$;

create or replace function month_spend(p_agency text, p_since timestamptz, p_include_simulated boolean)
returns numeric language sql stable as $
  select coalesce(sum(cost_usd), 0) from llm_calls
  where agency = p_agency and created_at >= p_since and (p_include_simulated or not simulated);
$;

-- ---------- Dashboard aggregation (see supabase/migrations/003_stage4.sql) ----------
-- Everything the dashboard's charts and KPI tiles need, aggregated in SQL in one call.
-- "Answered question" = a request with a successful answer call (not a rewrite, not an eval).
-- Cost per answered question sums ALL calls of those requests (rewrite + embedding + answer).
create or replace function dashboard_metrics(
  p_from timestamptz,
  p_to timestamptz,                       -- exclusive
  p_agency text default null,
  p_use_case text default null,
  p_model text default null,
  p_include_simulated boolean default true
)
returns jsonb
language sql stable as $
  with f as (
    select * from llm_calls
    where created_at >= p_from and created_at < p_to
      and (p_agency is null or agency = p_agency)
      and (p_use_case is null or use_case = p_use_case)
      and (p_model is null or model = p_model)
      and (p_include_simulated or not simulated)
  ),
  req as (
    select request_id,
           sum(cost_usd) as cost,
           bool_or(operation = 'chat' and status = 'ok' and use_case not in ('query-rewrite', 'eval-run')) as answered,
           max(latency_ms) filter (where operation = 'chat' and status = 'ok'
                                   and use_case not in ('query-rewrite', 'eval-run')) as latency
    from f group by request_id
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'spend_usd',                  (select coalesce(sum(cost_usd), 0) from f),
      'calls',                      (select count(*) from f),
      'input_tokens',               (select coalesce(sum(input_tokens), 0) from f),
      'output_tokens',              (select coalesce(sum(output_tokens), 0) from f),
      'answered_questions',         (select count(*) from req where answered),
      'cost_per_answered_question', (select avg(cost) from req where answered),
      'avg_answer_latency_ms',      (select avg(latency) from req where answered)
    ),
    'has_simulated', (select coalesce(bool_or(simulated), false) from f),
    'by_agency', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.cost_usd desc) from (
        select agency as key, count(*) as calls, sum(cost_usd) as cost_usd,
               sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens
        from f group by agency) t), '[]'::jsonb),
    'by_use_case', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.cost_usd desc) from (
        select use_case as key, count(*) as calls, sum(cost_usd) as cost_usd,
               sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens
        from f group by use_case) t), '[]'::jsonb),
    'by_model', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.cost_usd desc) from (
        select model as key, operation, count(*) as calls, sum(cost_usd) as cost_usd,
               sum(input_tokens) as input_tokens, sum(cached_input_tokens) as cached_input_tokens,
               sum(output_tokens) as output_tokens
        from f group by model, operation) t), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.day, t.agency) from (
        select (created_at at time zone 'utc')::date as day, agency, count(*) as calls, sum(cost_usd) as cost_usd
        from f group by 1, 2) t), '[]'::jsonb)
  );
$;

-- Month-to-date spend per agency, for the budget table.
create or replace function budget_mtd(p_since timestamptz, p_include_simulated boolean)
returns table (agency text, spend numeric)
language sql stable as $
  select agency, coalesce(sum(cost_usd), 0)
  from llm_calls
  where created_at >= p_since and (p_include_simulated or not simulated)
  group by agency;
$;

-- ---------- Dashboard helper views ----------
create or replace view v_daily_spend as
select date_trunc('day', created_at)::date as day, agency, use_case, model, simulated,
       count(*) as calls, sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens,
       sum(cost_usd) as cost_usd
from llm_calls
group by 1,2,3,4,5;

create or replace view v_request_cost as
select request_id, min(created_at) as created_at, max(agency) as agency, max(use_case) as use_case,
       bool_or(simulated) as simulated, sum(cost_usd) as cost_usd, count(*) as calls,
       max(latency_ms) filter (where operation = 'chat') as answer_latency_ms
from llm_calls
group by request_id;

-- ---------- Security ----------
-- The app uses the service-role key from server code only. Enable RLS with no
-- policies so the anon key can read nothing.
alter table documents   enable row level security;
alter table chunks      enable row level security;
alter table llm_calls   enable row level security;
alter table alerts      enable row level security;
alter table rate_limits enable row level security;
alter table eval_runs   enable row level security;
alter table eval_results enable row level security;
