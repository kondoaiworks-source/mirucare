-- Local development seed (run automatically after migrations on `supabase db reset`).
--
-- The application's migrations rely on the *hosted* Supabase default that grants
-- full DML privileges on the `public` schema to the anon/authenticated/service_role
-- roles. The local Supabase CLI stack does NOT grant those DML privileges by default,
-- so authenticated queries fail with "permission denied for table ...".
--
-- These GRANTs replicate the hosted behavior for LOCAL DEV ONLY. Row Level Security
-- (defined in the migrations) still enforces per-organization data isolation.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
