---
module: "Resume submission (Become a Candidate)"
date: "2026-10-29"
problem_type: security_issue
component: api_controller
symptoms:
  - "Public resume form accepted unlimited anonymous submissions with no bot check"
  - "Anonymous clients could insert into general_submissions and upload to storage general-submissions/ directly via the Supabase API"
  - "Admin status update on another account's job can return success with zero rows changed when RLS filters the update"
root_cause: missing_validation
resolution_type: code_fix
severity: medium
tags: [captcha, recaptcha-v3, edge-function, rls, supabase, storage]
---

# Troubleshooting: CAPTCHA on a Supabase form that writes directly from the browser

## Problem
The "Become a Candidate" resume form had no proof that a human was submitting it. A client-side CAPTCHA alone would not have fixed that: the form inserted into `general_submissions` and uploaded to the `applications` bucket straight from the browser using the anon key, so anyone could skip the widget and call those APIs directly.

## Environment
- Module: Resume submission (React 19 + Vite frontend, Supabase Postgres/Storage/Edge Functions)
- Affected Component: `src/pages/SubmitResumePage.tsx`, new `supabase/functions/submit-resume`, RLS/grants on `general_submissions`, storage policy
- Date: 2026-10-29

## Symptoms
- Unlimited anonymous submissions possible, no bot check
- Direct PostgREST insert and storage upload bypassed any UI control
- (Related admin fix) `supabase.from('jobs').update(...)` returns no error when RLS filters it to zero rows, so a failed admin inactivation looked successful

## What Didn't Work

**First design: upload from the browser, verify the CAPTCHA only in the function that inserts the row.**
- **Why it failed:** Review found the file was uploaded before verification. Failed or bot attempts left orphaned files, and the anonymous storage insert policy on `general-submissions/` stayed open, so the CAPTCHA only protected the table row, not storage. The client also derived the file extension from the file name while the server regex capped it at 5 characters, so a file named `MyResume` uploaded, then was rejected.

## Solution
Move the whole write path behind one verified server step.

- `submit-resume` edge function, in order: fail closed if `RECAPTCHA_SECRET_KEY` is missing; reject oversized requests by `Content-Length` before buffering; verify the reCAPTCHA v3 token with Google (5 s timeout, non-OK status rejected; require success, action `submit_resume` and score >= 0.5); validate fields; check the base64 length before decoding; accept only PDF/DOC/DOCX by MIME and derive the extension server-side; upload with the service role; insert the row; remove the uploaded file if the insert fails.
- Migration `20261029000000_resume_submit_via_function.sql`: drop the anon insert policy, `REVOKE INSERT` on `general_submissions` from `anon, authenticated`, and recreate the storage upload policy without the `general-submissions/` prefix.
- Client: `src/utils/recaptcha.ts` (script loaded once, token requested at submit time because v3 tokens expire in ~2 minutes), file sent base64 in the function call, CAPTCHA errors distinguished from other errors, explicit message when the site key is missing or the script is blocked. v3 is invisible, so the form shows Google's required privacy/terms notice instead of a widget.
- Admin: `updateJobStatus` now calls `.update(...).select('id')` and treats an empty result as a permission failure.

## Verification
- `npm run build` passes; `eslint` reports the same 30 problems as `main` (no new ones).
- `npm test` (scratch Postgres replaying all migrations) passes, including new R11 (anon and authenticated cannot insert `general_submissions`) and R12 (an admin can inactivate another account's job; a non-owner employer cannot).
- Three independent review passes (security, React, data integrity, test quality, Node); no P1 and no open P2 at the end.
- **Not verified:** the edge function was never executed (no Deno test, no deployed smoke test), and the reCAPTCHA flow was not exercised in a browser. Confirm both after deploy.

## Why This Works
The root cause was that the only enforcement point was the browser, while the database and storage accepted anonymous writes. With writes limited to the service role, the function is the only way in, and it checks the token before touching anything. Revoking the direct grants and the storage policy is what makes the CAPTCHA non-bypassable; the widget alone would not.

## Prevention
- When adding a CAPTCHA or rate limit to a Supabase form, remove the anon write paths (table grant, RLS policy, storage policy) in the same change.
- Verify the token before decoding, uploading or inserting anything.
- Supabase `update` with RLS returns no error for zero affected rows; request the rows back and check the count.

## Deploy order and prerequisites
1. Set `RECAPTCHA_SECRET_KEY` and deploy the function with `--no-verify-jwt` (`npm run deploy` does this).
2. Set `VITE_RECAPTCHA_SITE_KEY` at build time and deploy the frontend.
3. Run the migration. Running it any earlier breaks submissions from the old frontend bundle.

## Open follow-ups
- `ApplyPage` (job applications) has the same exposure, including anonymous writes to `resumes/` and `cover-letters/`.
- Magic-byte check on uploads; reject empty files; clean up the upload if the insert throws.
- Chunked requests without `Content-Length` bypass the early size guard.
- No unit tests for the edge function or the admin sort comparator.
