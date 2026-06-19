-- =============================================
-- renew_job RPC + block applications to non-active jobs
-- =============================================

-- 1. renew_job: an employer renews their own posting from the dashboard.
--    Resets the 30-day clock, reactivates the job, and clears the notify flags
--    so the lifecycle emails fire fresh next cycle. SECURITY DEFINER so the
--    update runs regardless of column-level RLS, but scoped to auth.uid().
create or replace function public.renew_job(p_job_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.jobs;
begin
  update public.jobs
     set status = 'active',
         expires_at = now() + interval '30 days',
         reminder_sent_at = null,
         expiry_notified_at = null
   where id = p_job_id
     and employer_id = auth.uid()
   returning * into r;

  if r.id is null then
    raise exception 'Job not found or not owned by the current user';
  end if;

  return r;
end;
$$;

grant execute on function public.renew_job(uuid) to authenticated;

-- 2. Only allow applications to active jobs. Replaces the permissive
--    "Anyone can submit applications" (WITH CHECK true) policy so expired /
--    inactive / filled postings can't receive new applications even if the URL
--    is hit directly. (UI also blocks this; this is the server-side guard.)
drop policy if exists "Anyone can submit applications" on public.applications;

create policy "Anyone can apply to active jobs"
  on public.applications for insert
  with check (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id
        and jobs.status = 'active'
    )
  );
