-- Resume submissions now go through the `submit-resume` edge function, which
-- verifies a Turnstile CAPTCHA, uploads the resume and inserts the row with the
-- service role. Remove the direct anon/authenticated paths (table INSERT and
-- storage upload to general-submissions/) so the CAPTCHA can't be bypassed by
-- calling PostgREST or the storage API directly.
--
-- DEPLOY ORDER (each step must be live before the next):
--   1. Deploy the `submit-resume` function and set TURNSTILE_SECRET_KEY.
--   2. Deploy the frontend (with VITE_TURNSTILE_SITE_KEY set).
--   3. Run this migration.
-- Running it earlier breaks resume submissions for the old frontend bundle.
--
-- ROLLBACK: re-grant and recreate the originals:
--   GRANT INSERT ON public.general_submissions TO anon, authenticated;
--   CREATE POLICY "Anyone can submit a general resume" ON public.general_submissions
--     FOR INSERT WITH CHECK (true);
--   and re-add 'general-submissions/%' to the storage upload policy below.

DROP POLICY IF EXISTS "Anyone can submit a general resume" ON public.general_submissions;

REVOKE INSERT ON public.general_submissions FROM anon, authenticated;

-- Anonymous uploads stay allowed for job applications only.
DROP POLICY IF EXISTS "Anyone can upload to allowed folders" ON storage.objects;
CREATE POLICY "Anyone can upload to allowed folders"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'applications'
    AND (name LIKE 'resumes/%' OR name LIKE 'cover-letters/%')
  );
