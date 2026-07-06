-- =============================================
-- Daily job-lifecycle maintenance via pg_cron
-- Flips expired jobs and dispatches reminder/expiry emails (batched) to the
-- job-lifecycle-emails Edge Function. Idempotent + advisory-locked so emails
-- are sent at most once per job per stage.
-- =============================================

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.run_daily_job_maintenance()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url       text;
  v_secret    text;
  v_reminders jsonb;
  v_expiries  jsonb;
begin
  -- Never let two overlapping runs double-send.
  if not pg_try_advisory_lock(hashtext('run_daily_job_maintenance')) then
    return;
  end if;

  -- (a) Flip ONLY active, past-expiry jobs to 'expired'. Never touch
  --     inactive/filled (those are deliberate employer states).
  update public.jobs
     set status = 'expired'
   where status = 'active'
     and expires_at <= now();

  -- (b1) Claim day-28 reminders: active jobs expiring within ~2 days, not yet
  --      reminded. Stamping reminder_sent_at in the same statement that selects
  --      them guarantees each job is reminded at most once.
  with due as (
    select id, employer_id, title, expires_at
      from public.jobs
     where status = 'active'
       and reminder_sent_at is null
       and expires_at > now()
       and expires_at <= now() + interval '2 days'
  ), marked as (
    update public.jobs j
       set reminder_sent_at = now()
      from due
     where j.id = due.id
     returning due.id, due.employer_id, due.title, due.expires_at
  )
  select jsonb_agg(to_jsonb(marked)) into v_reminders from marked;

  -- (b2) Claim expiry notices: jobs now expired, not yet notified.
  with due as (
    select id, employer_id, title
      from public.jobs
     where status = 'expired'
       and expiry_notified_at is null
       and expires_at <= now()
  ), marked as (
    update public.jobs j
       set expiry_notified_at = now()
      from due
     where j.id = due.id
     returning due.id, due.employer_id, due.title
  )
  select jsonb_agg(to_jsonb(marked)) into v_expiries from marked;

  -- Nothing to email -> done.
  if coalesce(jsonb_array_length(v_reminders), 0) = 0
     and coalesce(jsonb_array_length(v_expiries), 0) = 0 then
    return;
  end if;

  -- Secrets (same vault keys as the existing notification triggers).
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'supabase_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'function_secret';
  exception when others then
    return;
  end;

  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return;
  end if;

  -- One batched async POST; the Edge Function loops and emails each recipient.
  begin
    perform net.http_post(
      url := v_url || '/functions/v1/job-lifecycle-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := jsonb_build_object(
        'reminders', coalesce(v_reminders, '[]'::jsonb),
        'expiries',  coalesce(v_expiries,  '[]'::jsonb)
      )
    );
  exception when others then
    raise warning 'run_daily_job_maintenance dispatch failed: %', sqlerrm;
  end;
end;
$$;

-- Schedule daily at 13:00 UTC (~9am ET; DST drift acceptable for lifecycle email).
-- A named cron.schedule is an UPSERT (pg_cron >= 1.3) so re-running is safe.
select cron.schedule(
  'daily-job-maintenance',
  '0 13 * * *',
  $$ select public.run_daily_job_maintenance(); $$
);
