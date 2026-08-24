-- =============================================
-- Local association names (admin-approved DBAs)
--
-- A *state* association that signs up may hire on behalf of one of its *local*
-- associations, and the listing needs to carry the local name. Jess wants this
-- limited to state associations and wants to approve each name before it goes
-- public, so an association can't publish under an arbitrary name unreviewed.
--
-- Design notes:
--  * Names are per employer and reusable — approve "Three Rivers Association of
--    REALTORS" once, then it's selectable on every future posting.
--  * `jobs.company_name` stays the single denormalized display field. Every read
--    path already uses it and none of them change; `jobs.alt_name_id` only
--    records the linkage so the display name can be swapped server-side.
--  * Resolution is enforced by triggers, never the client: a pending name
--    publishes under the employer's real name and swaps on approval.
-- =============================================

-- ---------------------------------------------
-- 1. Gate: which employers may request a name
-- ---------------------------------------------
ALTER TABLE public.employers
  ADD COLUMN IF NOT EXISTS is_state_association boolean NOT NULL DEFAULT false;

-- ---------------------------------------------
-- 2. The requests themselves
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.employer_alt_names (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 200),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- One request per name per employer (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS employer_alt_names_employer_name_key
  ON public.employer_alt_names (employer_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS employer_alt_names_status_idx
  ON public.employer_alt_names (status);

CREATE INDEX IF NOT EXISTS employer_alt_names_employer_idx
  ON public.employer_alt_names (employer_id);

-- ---------------------------------------------
-- 3. Job linkage
-- ---------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS alt_name_id uuid
    REFERENCES public.employer_alt_names(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS jobs_alt_name_id_idx ON public.jobs (alt_name_id);

-- ---------------------------------------------
-- 4. Helpers
--
-- SECURITY DEFINER so policies on employer_alt_names never re-enter the
-- employers policies — the same recursion trap that 20260324000000 fixed with
-- is_admin().
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.my_employer_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.employers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Only an approved, active, admin-flagged state association may request a name.
CREATE OR REPLACE FUNCTION public.can_request_alt_name()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employers
    WHERE user_id = auth.uid()
      AND is_state_association = true
      AND is_approved = true
      AND is_disabled = false
  );
$$;

-- ---------------------------------------------
-- 5. RLS
-- ---------------------------------------------
ALTER TABLE public.employer_alt_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employers can view own alt names" ON public.employer_alt_names;
CREATE POLICY "Employers can view own alt names"
  ON public.employer_alt_names FOR SELECT
  USING (employer_id = public.my_employer_id());

DROP POLICY IF EXISTS "Admins can view all alt names" ON public.employer_alt_names;
CREATE POLICY "Admins can view all alt names"
  ON public.employer_alt_names FOR SELECT
  USING (public.is_admin());

-- Requests always start pending; an employer can't self-approve by sending
-- status='approved' on the insert.
DROP POLICY IF EXISTS "State associations can request alt names" ON public.employer_alt_names;
CREATE POLICY "State associations can request alt names"
  ON public.employer_alt_names FOR INSERT
  WITH CHECK (
    employer_id = public.my_employer_id()
    AND public.can_request_alt_name()
    AND status = 'pending'
  );

-- An employer may withdraw a request that hasn't been decided yet.
DROP POLICY IF EXISTS "Employers can withdraw pending alt names" ON public.employer_alt_names;
CREATE POLICY "Employers can withdraw pending alt names"
  ON public.employer_alt_names FOR DELETE
  USING (employer_id = public.my_employer_id() AND status = 'pending');

DROP POLICY IF EXISTS "Admins can review alt names" ON public.employer_alt_names;
CREATE POLICY "Admins can review alt names"
  ON public.employer_alt_names FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete alt names" ON public.employer_alt_names;
CREATE POLICY "Admins can delete alt names"
  ON public.employer_alt_names FOR DELETE
  USING (public.is_admin());

-- Employers/admins only — the public site reads the resolved jobs.company_name.
REVOKE ALL ON public.employer_alt_names FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employer_alt_names TO authenticated;

-- ---------------------------------------------
-- 6. Display-name resolution on jobs
--
-- The client never decides the published name. If a job links an alt name, the
-- name is recomputed here from the request's current status.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.jobs_apply_alt_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alt_name text;
  alt_status text;
  owner_user_id uuid;
  owner_company text;
BEGIN
  IF NEW.alt_name_id IS NULL THEN
    -- No linked request, so the job must carry the employer's own name. Without
    -- this an employer could just PATCH jobs.company_name directly (their RLS
    -- update policy doesn't restrict columns) and skip review entirely.
    -- Admins keep their deliberate override, and service-role writes — seeding,
    -- scraped listings — have no auth.uid() and are left alone.
    IF auth.uid() IS NOT NULL
       AND auth.uid() = NEW.employer_id
       AND NOT public.is_admin() THEN
      SELECT company_name INTO owner_company
      FROM public.employers WHERE user_id = NEW.employer_id;

      IF owner_company IS NOT NULL THEN
        NEW.company_name := owner_company;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  SELECT an.name, an.status, e.user_id, e.company_name
    INTO alt_name, alt_status, owner_user_id, owner_company
  FROM public.employer_alt_names an
  JOIN public.employers e ON e.id = an.employer_id
  WHERE an.id = NEW.alt_name_id;

  -- Unknown request — drop the link rather than trusting the submitted name.
  IF NOT FOUND THEN
    NEW.alt_name_id := NULL;
    RETURN NEW;
  END IF;

  -- An employer may only post under a name they requested themselves.
  IF owner_user_id IS DISTINCT FROM NEW.employer_id THEN
    RAISE EXCEPTION 'Alternate name % does not belong to the posting employer', NEW.alt_name_id;
  END IF;

  IF alt_status = 'approved' THEN
    NEW.company_name := alt_name;
  ELSE
    -- Pending or declined: publish under the association's real name.
    NEW.company_name := owner_company;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_apply_alt_name_trigger ON public.jobs;
CREATE TRIGGER jobs_apply_alt_name_trigger
  BEFORE INSERT OR UPDATE OF alt_name_id, company_name ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_apply_alt_name();

-- When a request is approved (or an approval is revoked), re-resolve every job
-- already linked to it so live listings swap in one statement.
CREATE OR REPLACE FUNCTION public.alt_name_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_company text;
BEGIN
  IF NEW.status = OLD.status AND NEW.name = OLD.name THEN
    RETURN NEW;
  END IF;

  SELECT company_name INTO owner_company
  FROM public.employers WHERE id = NEW.employer_id;

  IF NEW.status = 'approved' THEN
    UPDATE public.jobs SET company_name = NEW.name WHERE alt_name_id = NEW.id;
  ELSE
    UPDATE public.jobs SET company_name = owner_company WHERE alt_name_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alt_name_status_changed_trigger ON public.employer_alt_names;
CREATE TRIGGER alt_name_status_changed_trigger
  AFTER UPDATE ON public.employer_alt_names
  FOR EACH ROW
  EXECUTE FUNCTION public.alt_name_status_changed();

-- Deleting a request must also revert its listings. The FK's ON DELETE SET NULL
-- would otherwise clear the link and leave the approved local name published
-- with nothing backing it. Runs BEFORE the delete so the referential action has
-- nothing left to do.
CREATE OR REPLACE FUNCTION public.alt_name_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_company text;
BEGIN
  SELECT company_name INTO owner_company
  FROM public.employers WHERE id = OLD.employer_id;

  UPDATE public.jobs
     SET company_name = COALESCE(owner_company, company_name),
         alt_name_id = NULL
   WHERE alt_name_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS alt_name_deleted_trigger ON public.employer_alt_names;
CREATE TRIGGER alt_name_deleted_trigger
  BEFORE DELETE ON public.employer_alt_names
  FOR EACH ROW
  EXECUTE FUNCTION public.alt_name_deleted();

-- ---------------------------------------------
-- 7. Notify the admin of a new request
--
-- Same hardened shape as the other notification triggers (20260423000000):
-- vault reads in their own block, null-check before posting, and the POST
-- guarded so a failure never blocks the INSERT.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admin_alt_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  function_url text;
  function_secret text;
  requester_company text;
  requester_email text;
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

  SELECT company_name, COALESCE(email, '')
    INTO requester_company, requester_email
  FROM public.employers WHERE id = NEW.employer_id;

  BEGIN
    PERFORM net.http_post(
      url := function_url || '/functions/v1/notify-admin-alt-name',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || function_secret
      ),
      body := jsonb_build_object(
        'requestedName', NEW.name,
        'companyName', COALESCE(requester_company, ''),
        'email', COALESCE(requester_email, '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_alt_name failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_on_alt_name ON public.employer_alt_names;
CREATE TRIGGER notify_admin_on_alt_name
  AFTER INSERT ON public.employer_alt_names
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_alt_name();
