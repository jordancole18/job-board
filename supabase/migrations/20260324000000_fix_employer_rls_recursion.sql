-- Fix infinite recursion in employers RLS policies.
-- The "Admins can view/update all employers" policies query the employers
-- table itself, triggering the same policy check again in an infinite loop.
-- Solution: a SECURITY DEFINER function that bypasses RLS to check admin status.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employers
    WHERE user_id = auth.uid()
    AND is_admin = true
  );
$$;

-- Replace the recursive SELECT policy
DROP POLICY IF EXISTS "Admins can view all employers" ON public.employers;

CREATE POLICY "Admins can view all employers"
  ON public.employers FOR SELECT
  USING (public.is_admin());

-- Replace the recursive UPDATE policy
DROP POLICY IF EXISTS "Admins can update employers" ON public.employers;

CREATE POLICY "Admins can update employers"
  ON public.employers FOR UPDATE
  USING (public.is_admin());
