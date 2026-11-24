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
