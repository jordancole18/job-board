-- =============================================
-- Create core tables for JobBoard
-- =============================================

-- Employers table (linked to auth.users)
create table public.employers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  company_name text not null,
  created_at timestamptz default now()
);

-- Jobs table
create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  employer_id uuid references auth.users(id) on delete cascade,
  company_name text not null,
  title text not null,
  description text not null,
  requirements text not null,
  salary text not null,
  job_type text not null check (job_type in ('full-time', 'part-time', 'contract', 'remote')),
  address text,
  city text not null,
  state text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz default now()
);

-- Applications table
create table public.applications (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  resume_text text not null,
  cover_letter text,
  created_at timestamptz default now()
);
