---
title: "feat: Local association names (admin-approved DBA), clickable Paramount branding, admin application counts"
type: feat
status: active
date: 2026-08-24
origin: Aug 6, 2026 call — Jordan Cole & Jess Biller (Association Careers)
slicing_approach: vertical
---

# feat: Local Association Names, Paramount Link, Admin Application Counts

## Overview

Three items from the **Aug 6, 2026** call with Jess Biller. The first is the one she flagged as
"the only pressing one."

1. **Local association names** — a *state* association that signs up but hires on behalf of a
   *local* association can post under the local name, subject to admin approval (a DBA).
2. **Clickable Paramount Consulting Group branding** — navbar + footer link to the main site.
3. **Admin application counts** — Jess can see how many resumes each association's postings
   have pulled in, per job and in aggregate, so she knows who to call.

## Problem Statement / Motivation

**(1)** A state association signed up and needs to post a job for one of its local associations.
Today `jobs.company_name` is fixed to the poster's own association name (only admins can override
it), so the listing shows the wrong employer. Jess wants the capability, but gated: *"I only want
to make it available to state associations"*, and she wants to approve each name before it goes
public — an association shouldn't be able to publish under an arbitrary name unreviewed.

**(2)** A user asked whether the "Powered by Paramount Consulting Group" text could be clicked
through to Paramount's site. It's plain text in both the navbar and footer today.

**(3)** Jess is flying blind on engagement: *"they would get resumes that would come to them
which is cool but I have no idea what's happening."* Applications go straight to the employer;
the admin panel shows employers and jobs but no application counts. This is her core lead signal
— one resume on a 3-week-old posting means the association needs recruiting help; thirty means
they need help picking. The data already exists in `applications` / `job_views`; it's only
unexposed (and in fact unreadable — admins have no SELECT policy on either table).

---

## Data Design Decisions

- **`employer_alt_names.status` is a DB CHECK-constraint enum, not a lookup table**
  (`pending|approved|declined`). Matches the existing project convention for `jobs.status`,
  `applications.status`, and `applications.rating` — values are code-coupled (badge styles,
  filter logic, trigger branches) and are not runtime-editable content.
- **Alternate names are per *employer*, reusable** (not per job posting). A state association
  registers "Three Rivers Association of REALTORS" once, Jess approves it once, and it's
  selectable on every subsequent posting. Avoids re-approving the same local name monthly.
- **`jobs.company_name` stays the single denormalized display field.** Every read path
  (HomePage, JobCard, MapPage, JobDetailPage, sitemap, JSON-LD) already reads it, and none of
  them change. `jobs.alt_name_id` records the *linkage* so the display name can be swapped
  server-side when the request is approved.
- **Name resolution is enforced by a DB trigger, never by the client.** A `BEFORE INSERT/UPDATE`
  trigger on `jobs` overwrites `company_name` from the linked alt name's status; an
  `AFTER UPDATE` trigger on `employer_alt_names` back-fills every linked job when a name is
  approved or revoked. The browser cannot publish an unapproved name even by forging the request.
- **Pending names publish under the employer's real name** and swap on approval, so nothing is
  blocked waiting on Jess (she is travelling for ~a month). Approval is a display swap, not a
  gate on going live.

---

## ERD: new + changed tables

```
employers
  + is_state_association  boolean not null default false   -- admin-set gate

employer_alt_names                                          -- NEW
    id           uuid pk
    employer_id  uuid -> employers(id) on delete cascade
    name         text not null
    status       text not null default 'pending'
                   check (status in ('pending','approved','declined'))
    review_note  text                                       -- optional decline reason
    reviewed_at  timestamptz
    created_at   timestamptz default now()
  unique (employer_id, lower(name))

jobs
  + alt_name_id  uuid -> employer_alt_names(id) on delete set null
```

Display-name rule (enforced in `public.jobs_apply_alt_name()`):

```
alt_name_id IS NULL          -> company_name unchanged (employer's own / admin override)
alt name approved            -> company_name := alt name
alt name pending | declined  -> company_name := employer's company_name
alt name owned by someone else -> raise exception
```

---

## Implementation Phases

### Phase 1 — Clickable Paramount branding (smallest slice, ships alone)

- [x] Add a shared `PARAMOUNT_URL` constant so the URL lives in one place
- [x] Link the navbar "powered by Paramount Consulting Group" text
- [x] Link the footer "Powered by Paramount Consulting Group" text
- [x] `target="_blank"` + `rel="noopener noreferrer"`; keep the existing type scale/colors
- [ ] Verify: both links open Paramount's site, styling unchanged in light + mobile widths

### Phase 2 — Admin application counts (read-only slice, end-to-end)

- [x] Migration: admin SELECT policies on `applications` and `job_views` (neither exists today)
- [x] Migration: admin DELETE policy on `applications` — the admin panel's `deleteJob()` already
      tries to delete them and currently silently affects 0 rows
- [x] AdminPage: load application + view counts per job
- [x] AdminPage Job Postings tab: show resume + view count per posting
- [x] AdminPage Users tab: per-association aggregate (postings / resumes / views) with a
      drill-down to that association's postings
- [ ] Verify: counts match the employer's own dashboard for the same jobs

### Phase 3 — Local association names, end-to-end

- [ ] Migration: `employers.is_state_association`
- [ ] Migration: `employer_alt_names` table + indexes + RLS + grants
- [ ] Migration: `jobs.alt_name_id` + index
- [ ] Migration: `my_employer_id()` / `can_request_alt_name()` SECURITY DEFINER helpers
      (mirrors the existing `is_admin()` pattern that fixed RLS recursion)
- [ ] Migration: `jobs_apply_alt_name()` BEFORE trigger + `alt_name_status_changed()` AFTER trigger
- [ ] Migration: `notify_admin_alt_name()` notification trigger (hardened-trigger pattern)
- [ ] Edge function `notify-admin-alt-name` + add to the `deploy` script
- [ ] AuthContext: expose `isStateAssociation`
- [ ] PostJobPage: "Posting for a local association?" picker (approved names) + inline request form
- [ ] DashboardPage: "Association Names" card showing each request and its status
- [ ] AdminPage: `State Assoc` toggle on employer rows
- [ ] AdminPage: "Association Names" tab — pending queue with Approve / Decline
- [ ] Verify end-to-end: flag employer -> request name -> job publishes under real name ->
      approve -> listing swaps to the local name

---

## Out of Scope / Deferred

- **Behavioral-assessment upsell card** in the employer dashboard (video slot + "compare your
  candidates to the national benchmark" + interest button emailing Jess). Deferred at Jess's
  request until she has the promo video and copy — she's sourcing a video editor after her
  Spain/London travel.
- **Stripe / payment processing.** Jess has no Stripe account (banks through Huntington). Jordan
  to send onboarding link separately; no code until an account exists.
- **TTI portal automation** (folder creation, invite sending, usage-based billing, benchmark gap
  reports). Blocked on TTI API access; benchmarks live in Paramount's own account and TTI won't
  copy them to client accounts. Jordan has a test portal login to explore scraping.
- **Wholesale background checks** ($200/mo API floor). Waiting on user-demand signal.
- **Job expiration / renewal** — Phase 2+ of the Jun 18 plan, still unshipped. Not reopened here.
