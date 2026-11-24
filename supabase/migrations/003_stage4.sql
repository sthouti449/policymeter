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
