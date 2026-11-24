-- PolicyMeter: all migrations in one paste (001 to 005). Safe to run more than once.
-- Use this ONLY if you already ran the ORIGINAL supabase/schema.sql from the kit.
-- On a brand-new, empty project run supabase/schema.sql instead (it already includes all of this).

-- ================= 001_stage1 =================
-- Stage 1 migration. Run once in Supabase -> SQL Editor, AFTER schema.sql.
-- (A fresh install can skip this: schema.sql already contains these changes.)
-- Safe to run twice.

-- Time to first token, for the PRD's "p50 <= 4 s to first token" target.
alter table llm_calls add column if not exists ttft_ms int;

-- Alerts: wider money precision (tests use tiny budgets like $0.0001), and a
-- simulated flag so seeded traffic never produces alerts that look real.
alter table alerts alter column budget_usd type numeric(12,6);
alter table alerts add column if not exists simulated boolean not null default false;
alter table alerts drop constraint if exists alerts_agency_period_level_key;
alter table alerts drop constraint if exists alerts_unique_per_period;
alter table alerts add constraint alerts_unique_per_period unique (agency, period, level, simulated);

-- Daily spend that counts toward a cap. Real calls only (simulated = false).
-- 'global' = everything except the demo widget; 'demo' = the widget only.
-- Evals and ingestion are excluded so they can never lock the public out.
create or replace function daily_spend(p_since timestamptz, p_scope text)
returns numeric
language sql stable as $$
  select coalesce(sum(cost_usd), 0)
  from llm_calls
  where created_at >= p_since
    and not simulated
    and use_case not in ('eval-run', 'ingestion')
    and ((p_scope = 'demo' and agency = 'DEMO') or (p_scope = 'global' and agency <> 'DEMO'));
$$;

-- Month-to-date spend for one agency, for budget alerts.
create or replace function month_spend(p_agency text, p_since timestamptz, p_include_simulated boolean)
returns numeric
language sql stable as $$
  select coalesce(sum(cost_usd), 0)
  from llm_calls
  where agency = p_agency
    and created_at >= p_since
    and (p_include_simulated or not simulated);
$$;

-- ================= 002_stage2 =================
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

-- ================= 003_stage4 =================
-- Stage 4 migration. Run once in Supabase -> SQL Editor. Safe to run twice.
-- (Also added to schema.sql for fresh installs.)

-- Retrieval trace for the dashboard's "Trace" drawer: which chunks were retrieved,
-- with title, page, status and similarity. Stored as JSON so it survives a
-- re-ingest (chunk ids change on re-ingest, so ids alone would go stale).
-- No chunk text and no question text is stored here.
alter table llm_calls add column if not exists trace jsonb;

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
language sql stable as $$
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
$$;

-- Month-to-date spend per agency, for the budget table.
create or replace function budget_mtd(p_since timestamptz, p_include_simulated boolean)
returns table (agency text, spend numeric)
language sql stable as $$
  select agency, coalesce(sum(cost_usd), 0)
  from llm_calls
  where created_at >= p_since and (p_include_simulated or not simulated)
  group by agency;
$$;

-- ================= 004_stage6 =================
-- Stage 6 migration. Run once in Supabase -> SQL Editor. Safe to run twice.
-- (Also added to schema.sql for fresh installs.)

-- The PRD target is "p50 time to first token <= 4 s", so keep that separately from total latency.
alter table eval_runs add column if not exists p50_ttft_ms int;

-- Mean cost of the questions actually answered (rewrite + embedding + answer; the judge call is excluded).
alter table eval_runs add column if not exists cost_per_answered_usd numeric(12,8);

-- Which must_mention phrases an answer missed, and the request id so the dashboard's
-- trace drawer can open the exact question.
alter table eval_results add column if not exists misses text[];
alter table eval_results add column if not exists request_id uuid;

-- ================= 005_grants =================
-- Migration 005: let the server's API key (role service_role) use the tables. Safe to run twice.
--
-- Newer Supabase projects do not automatically grant API roles access to tables created
-- in the SQL editor, so the app's service key got "permission denied for table ...".
-- Only service_role is granted anything. The public anon and authenticated roles get
-- nothing, and row level security stays ON for every table, so the browser can read nothing.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Cover tables and functions added later by new migrations.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
