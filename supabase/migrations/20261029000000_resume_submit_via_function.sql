-- Resume submissions now go through the `submit-resume` edge function, which
-- verifies a Turnstile CAPTCHA and inserts with the service role. Remove the
-- direct anon/authenticated INSERT path so the CAPTCHA can't be bypassed by
-- calling PostgREST directly.
--
-- DEPLOY ORDER: deploy the `submit-resume` function (and set TURNSTILE_SECRET_KEY)
-- BEFORE running this migration, or resume submissions will fail in between.

DROP POLICY IF EXISTS "Anyone can submit a general resume" ON public.general_submissions;

REVOKE INSERT ON public.general_submissions FROM anon, authenticated;
