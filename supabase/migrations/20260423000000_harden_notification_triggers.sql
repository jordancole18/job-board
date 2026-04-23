-- Rewrite application/resume notification triggers to match the pattern of
-- notify_new_employer: wrap vault reads in their own exception block, null-check
-- before posting, and guard the http_post so failures never block the INSERT.

CREATE OR REPLACE FUNCTION public.notify_employer_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  function_url text;
  function_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO function_url
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_url';

    SELECT decrypted_secret INTO function_secret
      FROM vault.decrypted_secrets
      WHERE name = 'function_secret';
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF function_url IS NULL OR function_url = '' OR function_secret IS NULL OR function_secret = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := function_url || '/functions/v1/notify-employer-application',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || function_secret
      ),
      body := jsonb_build_object(
        'jobId', NEW.job_id::text,
        'applicantName', COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''),
        'applicantEmail', COALESCE(NEW.email, '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_employer_application failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_resume()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  function_url text;
  function_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO function_url
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_url';

    SELECT decrypted_secret INTO function_secret
      FROM vault.decrypted_secrets
      WHERE name = 'function_secret';
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF function_url IS NULL OR function_url = '' OR function_secret IS NULL OR function_secret = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := function_url || '/functions/v1/notify-admin-resume',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || function_secret
      ),
      body := jsonb_build_object(
        'candidateName', COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''),
        'candidateEmail', COALESCE(NEW.email, '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_resume failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Ensure triggers exist (in case prior migrations weren't applied in this env)
DROP TRIGGER IF EXISTS notify_employer_on_application ON public.applications;
CREATE TRIGGER notify_employer_on_application
  AFTER INSERT ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_employer_application();

DROP TRIGGER IF EXISTS notify_admin_on_resume ON public.general_submissions;
CREATE TRIGGER notify_admin_on_resume
  AFTER INSERT ON public.general_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_resume();
