-- =============================================
-- Add tags, admin, job status, applicant tracking,
-- general submissions, featured jobs
-- =============================================

-- 1. Add is_admin flag to employers
alter table public.employers
  add column is_admin boolean default false;

-- 2. Add status and is_featured to jobs
alter table public.jobs
  add column status text not null default 'active'
    check (status in ('active', 'inactive', 'filled')),
  add column is_featured boolean default false;

-- 3. Add status and rating to applications
alter table public.applications
  add column status text not null default 'unread'
    check (status in ('unread', 'read', 'contacted')),
  add column rating text not null default 'none'
    check (rating in ('none', 'high_potential', 'low_potential'));

-- 4. Tags table
create table public.tags (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  color text default '#6b7280',
  created_at timestamptz default now()
);

alter table public.tags enable row level security;

create policy "Anyone can view tags"
  on public.tags for select
  using (true);

create policy "Admins can insert tags"
  on public.tags for insert
  with check (
    exists (
      select 1 from public.employers
      where employers.user_id = auth.uid()
      and employers.is_admin = true
    )
  );

create policy "Admins can update tags"
  on public.tags for update
  using (
    exists (
      select 1 from public.employers
      where employers.user_id = auth.uid()
      and employers.is_admin = true
    )
  );

create policy "Admins can delete tags"
  on public.tags for delete
  using (
    exists (
      select 1 from public.employers
      where employers.user_id = auth.uid()
      and employers.is_admin = true
    )
  );

-- 5. Job-tags junction table
create table public.job_tags (
  job_id uuid references public.jobs(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (job_id, tag_id)
);

alter table public.job_tags enable row level security;

create policy "Anyone can view job tags"
  on public.job_tags for select
  using (true);

create policy "Employers can tag their own jobs"
  on public.job_tags for insert
  with check (
    exists (
      select 1 from public.jobs
      where jobs.id = job_tags.job_id
      and jobs.employer_id = auth.uid()
    )
  );

create policy "Employers can remove tags from their own jobs"
  on public.job_tags for delete
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_tags.job_id
      and jobs.employer_id = auth.uid()
    )
  );

-- 6. General resume submissions (confidential)
create table public.general_submissions (
  id uuid default gen_random_uuid() primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  looking_for text,
  preferred_location text,
  resume_url text,
  created_at timestamptz default now()
);

alter table public.general_submissions enable row level security;

create policy "Anyone can submit a general resume"
  on public.general_submissions for insert
  with check (true);

create policy "Only admins can view general submissions"
  on public.general_submissions for select
  using (
    exists (
      select 1 from public.employers
      where employers.user_id = auth.uid()
      and employers.is_admin = true
    )
  );

create policy "Only admins can update general submissions"
  on public.general_submissions for update
  using (
    exists (
      select 1 from public.employers
      where employers.user_id = auth.uid()
      and employers.is_admin = true
    )
  );

-- 7. Add update policy for jobs (for status changes)
create policy "Employers can update own jobs"
  on public.jobs for update
  using (auth.uid() = employer_id);

-- 8. Add update policy for applications (for status/rating)
create policy "Employers can update applications for their jobs"
  on public.applications for update
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id
      and jobs.employer_id = auth.uid()
    )
  );

-- 9. Seed initial tags
insert into public.tags (name, color) values
  ('Government Affairs', '#6366f1'),
  ('Marketing', '#ec4899'),
  ('Communications', '#f59e0b'),
  ('CEO / Executive', '#22c55e'),
  ('Finance', '#14b8a6'),
  ('Membership', '#f97316'),
  ('Events & Meetings', '#3b82f6'),
  ('General', '#8b5cf6');
