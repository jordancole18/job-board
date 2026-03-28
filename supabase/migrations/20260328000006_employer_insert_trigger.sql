-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that calls the notify-new-employer Edge Function
CREATE OR REPLACE FUNCTION public.notify_new_employer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  function_url text;
  function_secret text;
  request_body text;
BEGIN
  -- Build the Edge Function URL from the Supabase project URL
  SELECT value INTO function_url
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_url';

  SELECT value INTO function_secret
    FROM vault.decrypted_secrets
    WHERE name = 'function_secret';

  -- If secrets aren't configured, try environment-based URL
  IF function_url IS NULL THEN
    function_url := current_setting('app.settings.supabase_url', true);
  END IF;

  -- Fallback: construct from project ref
  IF function_url IS NULL OR function_url = '' THEN
    RETURN NEW;
  END IF;

  IF function_secret IS NULL OR function_secret = '' THEN
    RETURN NEW;
  END IF;

  request_body := json_build_object(
    'companyName', NEW.company_name,
    'email', COALESCE(NEW.email, '')
  )::text;

  -- Fire-and-forget HTTP POST to the Edge Function
  PERFORM extensions.http_post(
    url := function_url || '/functions/v1/notify-new-employer',
    body := request_body,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || function_secret
    )::jsonb
  );

  RETURN NEW;
END;
$$;

-- Trigger on employer INSERT
DROP TRIGGER IF EXISTS on_employer_created ON public.employers;
CREATE TRIGGER on_employer_created
  AFTER INSERT ON public.employers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_employer();
