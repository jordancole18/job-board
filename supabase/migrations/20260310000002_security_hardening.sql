-- Security hardening: restrict is_featured to admins, lock down storage paths

-- 1. Replace the broad job update policy with two specific ones:
--    - Employers can update their own jobs (but NOT is_featured)
--    - Admins can update is_featured on any job
DROP POLICY IF EXISTS "Employers can update own jobs" ON public.jobs;

CREATE POLICY "Employers can update own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = employer_id)
  WITH CHECK (auth.uid() = employer_id AND is_featured = (SELECT is_featured FROM public.jobs WHERE id = jobs.id));

CREATE POLICY "Admins can update is_featured"
  ON public.jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employers
      WHERE employers.user_id = auth.uid()
      AND employers.is_admin = true
    )
  );

-- 2. Restrict storage uploads to expected folder prefixes only
DROP POLICY IF EXISTS "Anyone can upload application files" ON storage.objects;

CREATE POLICY "Anyone can upload to allowed folders"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'applications'
    AND (name LIKE 'resumes/%' OR name LIKE 'cover-letters/%' OR name LIKE 'general-submissions/%')
  );

-- 3. Prevent employers from self-promoting to admin
CREATE POLICY "No self-update on employers"
  ON public.employers FOR UPDATE
  USING (false);
