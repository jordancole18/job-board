-- Fix missing GRANT permissions on tables created in later migrations.
-- The tags, job_tags, and general_submissions tables were created in
-- 20260310000000 but never received explicit GRANTs (same issue that
-- job_views had, fixed in 20260310000001). Without table-level GRANTs,
-- the 'authenticated' role cannot query these tables even though RLS
-- policies allow it — causing all homepage queries to fail when logged in.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.job_tags TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.general_submissions TO anon, authenticated;

-- Also ensure core tables have grants (belt-and-suspenders)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO anon, authenticated;

-- Prevent this from happening with future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;
