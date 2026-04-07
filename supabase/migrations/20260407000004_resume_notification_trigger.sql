-- Trigger to notify admin when a resume is submitted via Become a Candidate
CREATE OR REPLACE FUNCTION public.notify_admin_resume()
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
    url := _supabase_url || '/functions/v1/notify-admin-resume',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _function_secret),
    body := jsonb_build_object(
      'candidateName', COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''),
      'candidateEmail', COALESCE(NEW.email, '')
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- Never block the INSERT
END;
$$;

CREATE TRIGGER notify_admin_on_resume
  AFTER INSERT ON public.general_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_resume();
