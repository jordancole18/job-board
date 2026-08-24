-- =============================================
-- Admin engagement visibility
--
-- The admin panel needs per-association application ("resume") and view counts
-- so Paramount can see which associations are getting traction. The data has
-- always been in `applications` / `job_views`, but neither table has ever had
-- an admin SELECT policy — only "employers can read rows for their own jobs" —
-- so an admin querying them gets zero rows back.
--
-- Also adds the missing admin DELETE policy on `applications`: AdminPage's
-- deleteJob() already issues a delete of the job's applications, and today
-- that silently affects 0 rows before the job row itself is removed.
-- =============================================

-- Admins can read every application (they already read general_submissions,
-- and the resume inbox is the point of the admin panel).
DROP POLICY IF EXISTS "Admins can view all applications" ON public.applications;
CREATE POLICY "Admins can view all applications"
  ON public.applications FOR SELECT
  USING (public.is_admin());

-- Admins can delete applications (cascade cleanup when deleting a job).
DROP POLICY IF EXISTS "Admins can delete any application" ON public.applications;
CREATE POLICY "Admins can delete any application"
  ON public.applications FOR DELETE
  USING (public.is_admin());

-- Admins can read view counts for every job.
DROP POLICY IF EXISTS "Admins can view all job views" ON public.job_views;
CREATE POLICY "Admins can view all job views"
  ON public.job_views FOR SELECT
  USING (public.is_admin());

-- Admins can delete view rows (same cascade cleanup path in deleteJob()).
DROP POLICY IF EXISTS "Admins can delete any job view" ON public.job_views;
CREATE POLICY "Admins can delete any job view"
  ON public.job_views FOR DELETE
  USING (public.is_admin());

-- job_views was only ever granted SELECT, INSERT (20260310000001).
GRANT DELETE ON public.job_views TO authenticated;
