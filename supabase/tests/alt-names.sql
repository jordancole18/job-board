\set ON_ERROR_STOP on
\pset pager off

-- ---------- Arrange: an admin, a state association, and an unrelated employer
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@paramount.test'),
  ('22222222-2222-2222-2222-222222222222', 'state@ohio.test'),
  ('33333333-3333-3333-3333-333333333333', 'other@local.test');

INSERT INTO public.employers (user_id, company_name, email, is_admin, is_approved, is_state_association) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Paramount Consulting Group', 'admin@paramount.test', true, true, false),
  ('22222222-2222-2222-2222-222222222222', 'Ohio REALTORS', 'state@ohio.test', false, true, true),
  ('33333333-3333-3333-3333-333333333333', 'Unrelated Board', 'other@local.test', false, true, false);

\echo '=== T1: state assoc requests a local name (starts pending) ==='
SET app.uid = '22222222-2222-2222-2222-222222222222';
INSERT INTO public.employer_alt_names (employer_id, name)
  SELECT id, 'Three Rivers Association of REALTORS' FROM public.employers WHERE user_id = '22222222-2222-2222-2222-222222222222';
SELECT name, status FROM public.employer_alt_names;

\echo '=== T2: notification trigger fired ==='
SELECT url, body->>'requestedName' AS requested, body->>'companyName' AS requester FROM net._sent;

\echo '=== T3: job posted under a PENDING name publishes as the real association ==='
INSERT INTO public.jobs (employer_id, company_name, title, description, requirements, salary, job_type, work_arrangement, city, state, lat, lng, alt_name_id)
  SELECT '22222222-2222-2222-2222-222222222222', 'Three Rivers Association of REALTORS', 'Government Affairs Director',
         'd', 'r', '$100k', 'full-time', 'on-site', 'Pittsburgh', 'PA', 40.4, -80.0, id
  FROM public.employer_alt_names LIMIT 1;
SELECT title, company_name FROM public.jobs;

\echo '=== T4: approving swaps every linked listing over ==='
SET app.uid = '11111111-1111-1111-1111-111111111111';
UPDATE public.employer_alt_names SET status = 'approved', reviewed_at = now();
SELECT title, company_name FROM public.jobs;

\echo '=== T5: revoking the approval reverts linked listings ==='
UPDATE public.employer_alt_names SET status = 'declined', review_note = 'Not affiliated';
SELECT title, company_name FROM public.jobs;

\echo '=== T6: re-approve, then a NEW job under the approved name gets it ==='
UPDATE public.employer_alt_names SET status = 'approved', review_note = NULL;
SET app.uid = '22222222-2222-2222-2222-222222222222';
INSERT INTO public.jobs (employer_id, company_name, title, description, requirements, salary, job_type, work_arrangement, city, state, lat, lng, alt_name_id)
  SELECT '22222222-2222-2222-2222-222222222222', 'TOTALLY MADE UP NAME', 'CEO', 'd', 'r', '$1', 'full-time', 'on-site', 'Akron', 'OH', 41.0, -81.5, id
  FROM public.employer_alt_names LIMIT 1;
SELECT title, company_name FROM public.jobs ORDER BY title;

\echo '=== T7: employer CANNOT publish an unreviewed name with no linked request ==='
INSERT INTO public.jobs (employer_id, company_name, title, description, requirements, salary, job_type, work_arrangement, city, state, lat, lng)
  VALUES ('22222222-2222-2222-2222-222222222222', 'Sneaky Local Board', 'Sneaky Post', 'd', 'r', '$1', 'full-time', 'on-site', 'Toledo', 'OH', 41.6, -83.5);
SELECT title, company_name FROM public.jobs WHERE title = 'Sneaky Post';

\echo '=== T8: nor by UPDATEing company_name afterwards ==='
UPDATE public.jobs SET company_name = 'Sneaky Local Board' WHERE title = 'Sneaky Post';
SELECT title, company_name FROM public.jobs WHERE title = 'Sneaky Post';

\echo '=== T9: an employer cannot post under ANOTHER employer''s approved name ==='
SET app.uid = '33333333-3333-3333-3333-333333333333';
DO $$
BEGIN
  INSERT INTO public.jobs (employer_id, company_name, title, description, requirements, salary, job_type, work_arrangement, city, state, lat, lng, alt_name_id)
    SELECT '33333333-3333-3333-3333-333333333333', 'x', 'Theft Attempt', 'd', 'r', '$1', 'full-time', 'on-site', 'X', 'OH', 1, 1, id
    FROM public.employer_alt_names LIMIT 1;
  RAISE EXCEPTION 'SECURITY FAIL: cross-employer name theft succeeded';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'SECURITY FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'correctly blocked: %', SQLERRM;
END $$;

\echo '=== T10: admin override still works (alt_name_id NULL, is_admin) ==='
SET app.uid = '11111111-1111-1111-1111-111111111111';
INSERT INTO public.jobs (employer_id, company_name, title, description, requirements, salary, job_type, work_arrangement, city, state, lat, lng)
  VALUES ('11111111-1111-1111-1111-111111111111', 'Scraped Local Board', 'Admin Seeded', 'd', 'r', '$1', 'full-time', 'on-site', 'Columbus', 'OH', 40.0, -83.0);
SELECT title, company_name FROM public.jobs WHERE title = 'Admin Seeded';

\echo '=== T11: status-only updates do not disturb the resolved name ==='
SET app.uid = '22222222-2222-2222-2222-222222222222';
UPDATE public.jobs SET status = 'filled' WHERE title = 'CEO';
SELECT title, company_name, status FROM public.jobs WHERE title = 'CEO';

\echo '=== T12: duplicate name request for the same employer is rejected ==='
DO $$
BEGIN
  INSERT INTO public.employer_alt_names (employer_id, name)
    SELECT id, '  three rivers association of realtors  ' FROM public.employers WHERE user_id = '22222222-2222-2222-2222-222222222222';
  RAISE EXCEPTION 'FAIL: duplicate accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'correctly rejected duplicate (case/whitespace insensitive)';
END $$;

\echo '=== T13: deleting the request reverts linked listings to the real name ==='
SET app.uid = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.employer_alt_names;
SELECT title, company_name, alt_name_id FROM public.jobs ORDER BY title;
