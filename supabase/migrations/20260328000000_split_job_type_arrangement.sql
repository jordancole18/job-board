-- Split job_type into two fields: job_type (employment type) + work_arrangement (location flexibility)
-- Layered on top of 20260326000001_update_job_types.sql which set job_type to: remote, hybrid, in-office, contract

-- Drop old constraint FIRST so we can update values freely
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_job_type_check;

-- Add work_arrangement column
ALTER TABLE public.jobs ADD COLUMN work_arrangement text NOT NULL DEFAULT 'on-site';

-- Populate work_arrangement from current job_type values
UPDATE public.jobs SET work_arrangement = 'remote' WHERE job_type = 'remote';
UPDATE public.jobs SET work_arrangement = 'hybrid' WHERE job_type = 'hybrid';
UPDATE public.jobs SET work_arrangement = 'on-site' WHERE job_type = 'in-office';
UPDATE public.jobs SET work_arrangement = 'on-site' WHERE job_type = 'contract';

-- Convert job_type to employment types (contract stays contract, everything else defaults to full-time)
UPDATE public.jobs SET job_type = 'full-time' WHERE job_type IN ('remote', 'hybrid', 'in-office');

-- Add new constraints
ALTER TABLE public.jobs ADD CONSTRAINT jobs_job_type_check
  CHECK (job_type IN ('full-time', 'part-time', 'contract'));
ALTER TABLE public.jobs ADD CONSTRAINT jobs_work_arrangement_check
  CHECK (work_arrangement IN ('on-site', 'remote', 'hybrid'));
