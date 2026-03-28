-- Add is_disabled flag to employers - disabled users cannot log in
ALTER TABLE public.employers ADD COLUMN is_disabled boolean NOT NULL DEFAULT false;

-- Allow admins to delete employer records
DROP POLICY IF EXISTS "Admins can delete employers" ON public.employers;
CREATE POLICY "Admins can delete employers"
  ON public.employers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.employers AS admin
      WHERE admin.user_id = auth.uid()
      AND admin.is_admin = true
    )
  );
