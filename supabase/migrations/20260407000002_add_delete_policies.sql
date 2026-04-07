-- Grant DELETE on general_submissions (currently only SELECT, INSERT, UPDATE)
GRANT DELETE ON public.general_submissions TO authenticated;

-- Admin-only delete policy on general_submissions
CREATE POLICY "Admins can delete general submissions"
  ON public.general_submissions FOR DELETE
  USING (public.is_admin());

-- Storage delete policies for applications bucket
CREATE POLICY "Employers can delete own application files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'applications'
    AND (storage.foldername(name))[1] IN ('resumes', 'cover-letters')
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Admins can delete any application file"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'applications'
    AND public.is_admin()
  );

-- Admin-level job_tags policies (for admin editing tags on any job)
CREATE POLICY "Admins can insert job tags"
  ON public.job_tags FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete job tags"
  ON public.job_tags FOR DELETE
  USING (public.is_admin());
