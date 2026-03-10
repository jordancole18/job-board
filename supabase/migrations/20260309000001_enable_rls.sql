-- =============================================
-- Enable RLS and create policies
-- =============================================

alter table public.employers enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

-- Employers: users can read/insert their own record
create policy "Users can read own employer record"
  on public.employers for select
  using (auth.uid() = user_id);

create policy "Users can insert own employer record"
  on public.employers for insert
  with check (auth.uid() = user_id);

-- Jobs: anyone can read, only the posting employer can insert/delete
create policy "Anyone can view jobs"
  on public.jobs for select
  using (true);

create policy "Employers can insert own jobs"
  on public.jobs for insert
  with check (auth.uid() = employer_id);

create policy "Employers can delete own jobs"
  on public.jobs for delete
  using (auth.uid() = employer_id);

-- Applications: anyone can submit, employers can read/delete for their jobs
create policy "Anyone can submit applications"
  on public.applications for insert
  with check (true);

create policy "Employers can view applications for their jobs"
  on public.applications for select
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id
      and jobs.employer_id = auth.uid()
    )
  );

create policy "Employers can delete applications for their jobs"
  on public.applications for delete
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id
      and jobs.employer_id = auth.uid()
    )
  );
