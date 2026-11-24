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
