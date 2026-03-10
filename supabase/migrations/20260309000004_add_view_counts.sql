-- Track job posting views
create table public.job_views (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  viewed_at timestamptz default now()
);

alter table public.job_views enable row level security;

-- Anyone can insert a view (anonymous visitors)
create policy "Anyone can record a view"
  on public.job_views for insert
  with check (true);

-- Employers can read views for their own jobs
create policy "Employers can read views for their jobs"
  on public.job_views for select
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_views.job_id
      and jobs.employer_id = auth.uid()
    )
  );
