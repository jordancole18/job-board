-- Update job_type check constraint to use work arrangement types
-- Old: full-time, part-time, contract, remote
-- New: remote, hybrid, in-office, contract

-- Drop old constraint first so updates don't violate it
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_job_type_check;

-- Migrate existing data
UPDATE public.jobs SET job_type = 'in-office' WHERE job_type = 'full-time';
UPDATE public.jobs SET job_type = 'in-office' WHERE job_type = 'part-time';

-- Add new constraint
ALTER TABLE public.jobs ADD CONSTRAINT jobs_job_type_check
  CHECK (job_type IN ('remote', 'hybrid', 'in-office', 'contract'));
