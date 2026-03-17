-- Fix missing GRANT permissions on job_views table.
-- RLS policies exist but the underlying table permissions
-- may not have been granted to anon/authenticated roles.

GRANT SELECT, INSERT ON public.job_views TO anon, authenticated;
