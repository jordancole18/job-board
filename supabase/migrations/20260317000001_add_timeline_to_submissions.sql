-- Add timeline field to general_submissions
ALTER TABLE public.general_submissions
  ADD COLUMN timeline text;
