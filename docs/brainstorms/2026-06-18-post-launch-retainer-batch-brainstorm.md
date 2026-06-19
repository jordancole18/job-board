# Brainstorm: Post-Launch Retainer Batch (Jun 17 meeting w/ Jess Biller)

**Date:** 2026-06-18
**Source:** Jun 17, 2026 call between Jordan Cole and Jess Biller
**Context:** Job board is ready to launch. Paramount will seed listings by scraping
association job ads nationwide, create free pre-built accounts for those associations,
and use the board as a lead source for consulting/recruiting services. This batch is
the first round of work under a new ~$200/mo retainer.

---

## What We're Building

Six items, bundled into one brainstorm. Four are contained fixes; one is a real
feature; two are lightweight follow-ups.

### 1. Keyword search should match tags + description (not just title)
**Problem:** The search box reads "job title or keyword," but it only matches the job
title (and company name) on the map, and title/company/description on the homepage.
Neither searches the **tags/categories**. Typing "CEO" or "Finance" misses jobs that
are *tagged* CEO/Finance but not titled that way. Jess confirmed: a job could be titled
in Government Affairs but tagged Finance — the keyword needs to find it either way.
**Build:** Extend the keyword filter to match across `title`, `company_name`,
`description`, **and** the names of assigned tags (`job_tags` → `tags.name`). Make the
homepage and map page consistent (map currently doesn't even select `description`).

### 2. State search should zoom to state level
**Problem:** Any location search forces a fixed `zoom 10` (city level), and Nominatim's
top hit for a state name often lands on a random small city. "California" should show
the whole state, not a town.
**Build:** Use the geocoding result's place type / bounding box to choose zoom —
`fitBounds` to the returned bounding box (or a type-appropriate zoom) so a state query
gives a state-level view and a city query stays city-level. Applies to both the sidebar
autocomplete path and the `?location=` URL param path.

### 3. Overlapping markers + hover-to-popup
**Problem:** Jess preferred the *old* behavior where overlapping markers showed multiple
job titles together. Current behavior shows a count badge that flies-in/spreads only on
**click**. She also asked: can the job pop up on **hover** instead of requiring a click?
**Build:** (a) Show the job popup on marker **hover**. (b) For co-located/overlapping
jobs, surface them together (a hover list of the jobs at that point) rather than forcing
a zoom-in. Reuse the existing co-location grouping logic; change the trigger and
presentation.

### 4. 30-day job posting expiration + reminder emails (the main feature)
**Problem:** Jobs never expire today. Paramount doesn't want stale listings, and doesn't
want to manually audit which postings have been up 30 days. Expiration also doubles as a
**lead signal** — a job that hits 30 days unfilled means the employer may be struggling
and is a candidate for recruiting/assessment services.
**Build:**
- Add `expires_at` to `jobs` (default `created_at + 30 days`).
- A daily **pg_cron** job:
  - Flips `active → expired` where `expires_at < now()`.
  - Selects jobs at **day 28** (reminder) and **day 30** (expired) and calls the
    existing SMTP edge-function pattern via `net.http_post` to send emails.
- **Day 28:** reminder email to the **employer** ("expires in 2 days — log in and renew")
  + copy to **admin/Paramount**.
- **Day 30 (if not renewed):** "expired" notice to the employer + **"expired unfilled —
  reach out" lead alert** to admin/Paramount.
- **Renewal:** employer logs into the dashboard and clicks renew, which resets
  `expires_at` to +30 days. Renewable anytime from the dashboard. Expired jobs stay in
  the dashboard and can be reactivated (non-destructive).

### 5. Google Analytics (follow-up)
Add GA4 alongside whatever analytics exists today, for live traffic / page-path data.
Jess wants to see visitor counts and which pages get clicked. Also a mild SEO/indexing
signal. Lightweight.

### 6. SEO for job postings (follow-up)
Make job postings discoverable in Google ("Association careers" searches; competitors are
ASAE, Indeed, LinkedIn, ZipRecruiter, Association Forum). Add `JobPosting` structured
data (schema.org) + a sitemap so Google can index individual postings. **Note:** the app
is a client-rendered Vite SPA — structured data and possibly prerendering/meta tags per
job matter here; needs a scoping pass. Expectation set with Jess: ranking is a 3–6 month
organic effort, not a quick win.

---

## Why This Approach

- **pg_cron over a scheduled Edge Function or external cron:** keeps everything inside
  Supabase, reuses the existing vault-secret + `FUNCTION_SECRET` + `net.http_post` →
  SMTP edge-function convention already used for application/resume/employer
  notifications. No new infrastructure or secrets.
- **Expire = status flip, not delete:** reversible, preserves applicant history, and
  fits Jess's "comes down unless you refresh" framing. Reuses the existing
  `active/inactive/filled` status field (adds `expired` to the check constraint).
- **Renewal via dashboard login (not a tokenized one-click link):** Jess's chosen
  trade-off — accounts are pre-created for associations, and she preferred the
  login-gated path over a no-auth token link.
- **Search across tags via the existing `job_tags` join:** tags are already a proper
  many-to-many table, so this is a query change, not a schema change.
- **Bundled scope:** tracked as one brainstorm, but naturally sequences as quick wins
  first (search, map zoom, marker hover — Jordan is doing these over the Gatlinburg
  trip), then the expiration feature, then GA + SEO.

---

## Key Decisions

| Decision | Choice |
|---|---|
| Day-30 behavior | Auto-flip `status` → `expired` (hidden publicly, reactivatable) |
| Status constraint | Add `'expired'` to `jobs.status` check (`active/inactive/filled/expired`) |
| Renewal mechanism | Dashboard login + renew button; resets `expires_at` +30d; renewable anytime |
| Admin alerts | Day-28 reminder **and** day-30 "expired unfilled" lead alert to Paramount |
| Scheduler | pg_cron daily job in Supabase |
| Email transport | Reuse existing denomailer SMTP edge-function pattern |
| Reminder cadence | Day 28 reminder, Day 30 expire (per "tomorrow or in two days will be the 30th") |
| Search fields | `title` + `company_name` + `description` + assigned tag names; homepage & map consistent |
| State zoom | Use geocode result bounding box / place type to pick zoom |
| Marker interaction | Popup on hover; co-located jobs shown together (list), not click-to-spread |
| Doc scope | Single bundled brainstorm covering all six items |

---

## Resolved Questions

1. **Backfill of existing listings:** `expires_at = created_at + 30 days` for existing
   jobs. *(Practically fine because Jess is clearing out and re-adding listings at
   launch, so `created_at` ≈ launch date for the seeded set. Watch for any genuinely
   old jobs that would expire immediately.)*
2. **Mobile hover fallback:** Hover-to-popup on desktop, **tap-to-popup on mobile**.
3. **SEO depth:** Phase A first — `JobPosting` JSON-LD structured data + `sitemap.xml`
   (high-leverage, low-effort). Phase B — per-job meta tags / SPA prerendering — only if
   indexing lags. Aligns with the 3–6 month organic timeline set with Jess.

## Open Questions

_None remaining._

---

## Out of Scope / Deferred (captured for the retainer backlog)

- **Payment processing / charging employers** — Jess will trigger this once the board
  gains traction.
- **Ad monetization (AdMob banner above/below the map)** — discussed; Jess leans toward
  monetizing via employers rather than ads, wants to keep the home page clean. Parked.
- **Assessment/benchmark integration** — admin "send survey link" button so an employer's
  candidate can complete Paramount's assessment and be compared to a national benchmark
  (e.g. benchmark of a CEO / Marketing Communications Director). Strong future lead-gen
  idea; not in this batch.
- **Spree-forms → Mailgun migration** for Jess's separate one-page training site — Jordan
  offered; Jess declined for now (low volume).
