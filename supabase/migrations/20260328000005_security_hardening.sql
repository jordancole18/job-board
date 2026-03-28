-- =============================================
-- Security Hardening Migration
-- Fixes: H1 (disabled user bypass), H2 (settings visibility),
--        H3 (overly permissive anon grants), H4 (storage IDOR)
-- =============================================

-- =============================================
-- H1: Enforce is_disabled at the database level
-- Disabled users cannot insert/update jobs or read applications
-- =============================================

-- Block disabled users from inserting jobs
DROP POLICY IF EXISTS "Approved employers can insert own jobs" ON public.jobs;
CREATE POLICY "Approved active employers can insert own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (
    auth.uid() = employer_id
    AND EXISTS (
      SELECT 1 FROM public.employers
      WHERE employers.user_id = auth.uid()
      AND employers.is_approved = true
      AND employers.is_disabled = false
    )
  );

-- Block disabled users from updating jobs
DROP POLICY IF EXISTS "Employers can update own jobs" ON public.jobs;
CREATE POLICY "Active employers can update own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = employer_id)
  WITH CHECK (
    auth.uid() = employer_id
    AND EXISTS (
      SELECT 1 FROM public.employers
      WHERE employers.user_id = auth.uid()
      AND employers.is_disabled = false
    )
  );

-- Block disabled users from reading applications
DROP POLICY IF EXISTS "Employers can view applications for their jobs" ON public.applications;
CREATE POLICY "Active employers can view applications for their jobs"
  ON public.applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.employers ON employers.user_id = jobs.employer_id
      WHERE jobs.id = applications.job_id
      AND jobs.employer_id = auth.uid()
      AND employers.is_disabled = false
    )
  );

-- =============================================
-- H2: Restrict site_settings to admins only
-- =============================================

DROP POLICY IF EXISTS "Anyone can read settings" ON public.site_settings;
CREATE POLICY "Admins can read settings"
  ON public.site_settings FOR SELECT
  USING (public.is_admin());

-- =============================================
-- H3: Tighten anon role grants to minimum necessary
-- =============================================

-- Revoke everything first, then grant only what's needed
REVOKE ALL ON public.employers FROM anon;
REVOKE ALL ON public.jobs FROM anon;
REVOKE ALL ON public.applications FROM anon;
REVOKE ALL ON public.tags FROM anon;
REVOKE ALL ON public.job_tags FROM anon;
REVOKE ALL ON public.general_submissions FROM anon;
REVOKE ALL ON public.job_views FROM anon;
REVOKE ALL ON public.site_settings FROM anon;

-- Anon only needs SELECT on public-facing data and INSERT for applications/views/submissions
GRANT SELECT ON public.jobs TO anon;
GRANT SELECT ON public.tags TO anon;
GRANT SELECT ON public.job_tags TO anon;
GRANT INSERT ON public.applications TO anon;
GRANT INSERT ON public.general_submissions TO anon;
GRANT INSERT ON public.job_views TO anon;

-- Authenticated users need full access (still gated by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.job_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.general_submissions TO authenticated;
GRANT SELECT, INSERT ON public.job_views TO authenticated;
GRANT SELECT, UPDATE ON public.site_settings TO authenticated;

-- Remove the dangerous default privileges grant and replace with safe defaults
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO authenticated;

-- =============================================
-- H4: Scope storage access — employers only see their own job's files, admins see all
-- =============================================

DROP POLICY IF EXISTS "Authenticated users can read application files" ON storage.objects;

-- Admins can read all files
CREATE POLICY "Admins can read all application files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'applications'
    AND public.is_admin()
  );

-- Employers can read files for applications to their own jobs
CREATE POLICY "Employers can read own job application files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'applications'
    AND (name LIKE 'resumes/%' OR name LIKE 'cover-letters/%')
    AND EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE j.employer_id = auth.uid()
      AND (a.resume_url = storage.objects.name OR a.cover_letter_url = storage.objects.name)
    )
  );
