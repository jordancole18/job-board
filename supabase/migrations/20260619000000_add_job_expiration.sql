-- =============================================
-- Job posting expiration (30-day lifecycle)
-- Adds expires_at + idempotency columns, the 'expired' status,
-- backfills existing rows, and suppresses first-run emails.
-- =============================================

-- 1. Columns: expiry date + per-job idempotency stamps for the daily cron.
alter table public.jobs
  add column if not exists expires_at         timestamptz not null default (now() + interval '30 days'),
  add column if not exists reminder_sent_at   timestamptz,
  add column if not exists expiry_notified_at timestamptz;

-- 2. Add 'expired' to the status enum (drop + recreate the check constraint).
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in ('active', 'inactive', 'filled', 'expired'));

-- 3. Backfill existing rows: 30 days from their original post date.
update public.jobs set expires_at = created_at + interval '30 days';

-- 4. First-run email suppression. Any job whose computed expiry is already in the
--    past is expired immediately with its notify flags pre-stamped, so the first
--    cron run silently removes it WITHOUT emailing the employer or admin.
--    (Only touches currently-active jobs; inactive/filled are left alone.)
update public.jobs
   set status = 'expired',
       reminder_sent_at = now(),
       expiry_notified_at = now()
 where status = 'active'
   and expires_at <= now();

-- 5. Partial indexes so the daily scan stays cheap as the table grows.
create index if not exists jobs_reminder_due_idx
  on public.jobs (expires_at)
  where status = 'active' and reminder_sent_at is null;

create index if not exists jobs_expiry_pending_idx
  on public.jobs (expires_at)
  where expiry_notified_at is null;
