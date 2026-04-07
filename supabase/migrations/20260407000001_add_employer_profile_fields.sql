-- Add profile fields to employers table
ALTER TABLE public.employers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text;

-- SECURITY DEFINER function for employer self-update (prevents privilege escalation)
-- Employers must NOT be able to set is_admin, is_approved, is_disabled on themselves
CREATE OR REPLACE FUNCTION public.update_employer_profile(
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_company_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employers
  SET
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    title = COALESCE(p_title, title),
    company_name = COALESCE(p_company_name, company_name),
    address = COALESCE(p_address, address),
    city = COALESCE(p_city, city),
    state = COALESCE(p_state, state),
    zip = COALESCE(p_zip, zip)
  WHERE user_id = auth.uid();
END;
$$;
