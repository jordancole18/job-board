\set ON_ERROR_STOP on
\pset pager off

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@paramount.test'),
  ('22222222-2222-2222-2222-222222222222', 'state@ohio.test'),
  ('33333333-3333-3333-3333-333333333333', 'plain@local.test');
INSERT INTO public.employers (user_id, company_name, email, is_admin, is_approved, is_state_association) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Paramount Consulting Group', 'a@p.test', true, true, false),
  ('22222222-2222-2222-2222-222222222222', 'Ohio REALTORS', 's@o.test', false, true, true),
  ('33333333-3333-3333-3333-333333333333', 'Plain Local Board', 'p@l.test', false, true, false);

\echo '=== R1: a NON state association cannot request a name (RLS blocks) ==='
SET ROLE authenticated;
SET app.uid = '33333333-3333-3333-3333-333333333333';
DO $$
BEGIN
  INSERT INTO public.employer_alt_names (employer_id, name)
    SELECT id, 'Wishful Board' FROM public.employers WHERE user_id = '33333333-3333-3333-3333-333333333333';
  RAISE EXCEPTION 'SECURITY FAIL: non-state-assoc inserted a name request';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'correctly blocked by RLS';
  WHEN raise_exception THEN
    IF SQLERRM LIKE 'SECURITY FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'blocked: %', SQLERRM;
END $$;
RESET ROLE;

\echo '=== R2: a state association CAN request a name ==='
SET ROLE authenticated;
SET app.uid = '22222222-2222-2222-2222-222222222222';
INSERT INTO public.employer_alt_names (employer_id, name)
  SELECT id, 'Three Rivers Association of REALTORS' FROM public.employers WHERE user_id = '22222222-2222-2222-2222-222222222222';
SELECT name, status FROM public.employer_alt_names;
RESET ROLE;

\echo '=== R3: it cannot self-approve on insert ==='
SET ROLE authenticated;
SET app.uid = '22222222-2222-2222-2222-222222222222';
DO $$
BEGIN
  INSERT INTO public.employer_alt_names (employer_id, name, status)
    SELECT id, 'Pre-approved Board', 'approved' FROM public.employers WHERE user_id = '22222222-2222-2222-2222-222222222222';
  RAISE EXCEPTION 'SECURITY FAIL: self-approved on insert';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'correctly blocked by RLS';
  WHEN raise_exception THEN
    IF SQLERRM LIKE 'SECURITY FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'blocked: %', SQLERRM;
END $$;
RESET ROLE;

\echo '=== R4: it cannot approve its own pending request via UPDATE ==='
SET ROLE authenticated;
SET app.uid = '22222222-2222-2222-2222-222222222222';
UPDATE public.employer_alt_names SET status = 'approved';
SELECT name, status, 'rows updated by employer: ' || (SELECT count(*) FROM public.employer_alt_names WHERE status='approved') AS approved_count FROM public.employer_alt_names;
RESET ROLE;

\echo '=== R5: another employer cannot even SEE the request ==='
SET ROLE authenticated;
SET app.uid = '33333333-3333-3333-3333-333333333333';
SELECT count(*) AS visible_to_other_employer FROM public.employer_alt_names;
RESET ROLE;

\echo '=== R6: the admin CAN see and approve it ==='
SET ROLE authenticated;
SET app.uid = '11111111-1111-1111-1111-111111111111';
SELECT count(*) AS visible_to_admin FROM public.employer_alt_names;
UPDATE public.employer_alt_names SET status = 'approved', reviewed_at = now();
SELECT name, status FROM public.employer_alt_names;
RESET ROLE;

\echo '=== R7: employer can withdraw a PENDING request but not an APPROVED one ==='
SET ROLE authenticated;
SET app.uid = '22222222-2222-2222-2222-222222222222';
DELETE FROM public.employer_alt_names;
SELECT count(*) AS still_present_after_employer_delete FROM public.employer_alt_names;
RESET ROLE;

\echo '=== R8: admin CAN delete it ==='
SET ROLE authenticated;
SET app.uid = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.employer_alt_names;
SELECT count(*) AS remaining FROM public.employer_alt_names;
RESET ROLE;

\echo '=== R9: anon has no access at all ==='
SET ROLE anon;
DO $$
BEGIN
  PERFORM count(*) FROM public.employer_alt_names;
  RAISE EXCEPTION 'SECURITY FAIL: anon can read name requests';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'correctly denied to anon';
  WHEN raise_exception THEN
    IF SQLERRM LIKE 'SECURITY FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'denied: %', SQLERRM;
END $$;
RESET ROLE;

\echo '=== R10: admin can read applications and job_views (Phase 2 policies) ==='
SET ROLE authenticated;
SET app.uid = '11111111-1111-1111-1111-111111111111';
SELECT count(*) AS admin_can_query_applications FROM public.applications;
SELECT count(*) AS admin_can_query_job_views FROM public.job_views;
RESET ROLE;
