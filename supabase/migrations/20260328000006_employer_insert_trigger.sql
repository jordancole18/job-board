-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that calls the notify-new-employer Edge Function
-- Wrapped in exception handler so it NEVER blocks the employer INSERT
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
  -- Try to read secrets from vault; if vault isn't set up, silently skip
  BEGIN
    SELECT decrypted_secret INTO function_url
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_url';

    SELECT decrypted_secret INTO function_secret
      FROM vault.decrypted_secrets
      WHERE name = 'function_secret';
  EXCEPTION WHEN OTHERS THEN
    -- Vault not available or secrets not set — skip notification
    RETURN NEW;
  END;

  -- If secrets aren't configured, skip
  IF function_url IS NULL OR function_url = '' OR function_secret IS NULL OR function_secret = '' THEN
    RETURN NEW;
  END IF;

  request_body := json_build_object(
    'companyName', NEW.company_name,
    'email', COALESCE(NEW.email, '')
  )::text;

  -- Fire-and-forget HTTP POST to the Edge Function
  BEGIN
    PERFORM net.http_post(
      url := function_url || '/functions/v1/notify-new-employer',
      body := request_body::jsonb,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || function_secret
      )::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    -- HTTP call failed — don't block the INSERT
    RAISE WARNING 'notify_new_employer failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Trigger on employer INSERT
DROP TRIGGER IF EXISTS on_employer_created ON public.employers;
CREATE TRIGGER on_employer_created
  AFTER INSERT ON public.employers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_employer();
