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
