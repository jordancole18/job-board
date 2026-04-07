-- Trigger to notify employer when an application is submitted
CREATE OR REPLACE FUNCTION public.notify_employer_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _function_secret text;
BEGIN
  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO _function_secret FROM vault.decrypted_secrets WHERE name = 'function_secret';

  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/notify-employer-application',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _function_secret),
    body := jsonb_build_object(
      'jobId', NEW.job_id::text,
      'applicantName', COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''),
      'applicantEmail', COALESCE(NEW.email, '')
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- Never block the INSERT
END;
$$;

CREATE TRIGGER notify_employer_on_application
  AFTER INSERT ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_employer_application();
