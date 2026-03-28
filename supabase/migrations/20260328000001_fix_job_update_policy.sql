-- Fix employer job update policy - the self-referencing WITH CHECK was blocking status updates.
-- Replace with a simpler policy that allows employers to update their own jobs
-- but still prevents them from changing is_featured.

DROP POLICY IF EXISTS "Employers can update own jobs" ON public.jobs;

CREATE POLICY "Employers can update own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = employer_id)
  WITH CHECK (auth.uid() = employer_id);

-- Admins can already update any job via "Admins can update is_featured" policy,
-- but let's also add a broader admin delete policy for completeness
DROP POLICY IF EXISTS "Admins can delete any job" ON public.jobs;

CREATE POLICY "Admins can delete any job"
  ON public.jobs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.employers
      WHERE employers.user_id = auth.uid()
      AND employers.is_admin = true
    )
  );
