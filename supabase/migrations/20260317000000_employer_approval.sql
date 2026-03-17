-- Employer approval: new employers must be approved by admin before posting jobs

-- 1. Add is_approved column (admins auto-approved, everyone else pending)
ALTER TABLE public.employers
  ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

UPDATE public.employers SET is_approved = true WHERE is_admin = true;

-- 2. Replace the jobs INSERT policy to require approval
DROP POLICY IF EXISTS "Employers can insert own jobs" ON public.jobs;

CREATE POLICY "Approved employers can insert own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (
    auth.uid() = employer_id
    AND EXISTS (
      SELECT 1 FROM public.employers
      WHERE employers.user_id = auth.uid()
      AND employers.is_approved = true
    )
  );

-- 3. Replace the blanket employers UPDATE block with admin-only updates
DROP POLICY IF EXISTS "No self-update on employers" ON public.employers;

CREATE POLICY "Admins can update employers"
  ON public.employers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employers AS admin
      WHERE admin.user_id = auth.uid()
      AND admin.is_admin = true
    )
  );

-- 4. Let admins read all employer records (for the approval list)
CREATE POLICY "Admins can view all employers"
  ON public.employers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employers AS admin
      WHERE admin.user_id = auth.uid()
      AND admin.is_admin = true
    )
  );
