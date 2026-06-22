# Design Discussion: Post-Launch Retainer Batch

**Date:** 2026-06-18
**Feature:** Six items from the Jun 17 Jess Biller call — keyword/tag search, map state zoom, marker hover popups, 30-day job expiration with emails, GA4, and JobPosting SEO.
**Origin brainstorm:** `docs/brainstorms/2026-06-18-post-launch-retainer-batch-brainstorm.md`

---

## Current State

- **Search** is client-side, in-memory. `HomePage.tsx` filters `title + company_name + description`; the hero search just redirects to `/map?q=…`. `MapPage.tsx` is the real search surface but its keyword filter only matches `title + company_name` and doesn't even `select` `description`. **Neither searches tags** — tags live in the `job_tags` join → `tags.name`, already joined in the HomePage query (`job_tags(tag_id, tags(name,color))`).
- **Map zoom**: both the autocomplete path (`MapPage.handleLocationSelect`) and the `?location=` URL path hardcode `zoom 10` (or `radiusToZoom(radius)` if a radius is set). Nominatim's top hit for a state name often resolves to a city, so a state search lands city-zoomed on a random town. `boundingbox` is returned by Nominatim but unused.
- **Markers** (`MapView.tsx`): single jobs render a green pin with a **click→Popup**. Co-located jobs (bucketed by `lat/lng.toFixed(5)`) render one **count-badge** that, on **click**, flies to zoom 15 and spreads pins in a circle. There is no hover behavior. (Note: `react-leaflet-cluster` was added in the round-1 plan but later **dropped** in commit `f483f06` for this hand-rolled approach — clustering is not coming back.)
- **Job lifecycle**: `jobs.status` is `active|inactive|filled` (DB check constraint). `created_at` exists; **no `expires_at`, no scheduler.** `DashboardPage` renders each job with a status `<select>` and `updateJobStatus()`. Public views hard-filter `status='active'`.
- **Email**: Edge Functions (Deno + denomailer SMTP) auth'd by `Authorization: Bearer ${FUNCTION_SECRET}`, invoked from plpgsql trigger functions via `net.http_post`, secrets from `vault.decrypted_secrets` (`supabase_url`, `function_secret`). Admin email lives in `site_settings.approval_notification_email`. **All event-driven (AFTER INSERT) — no cron exists.** `pg_net` is enabled; `pg_cron` is not.
- **SEO/analytics**: `index.html` already has `WebSite` + `SearchAction` JSON-LD and OG/Twitter meta. `public/sitemap.xml` is a tiny static stub; `public/robots.txt` exists. No per-job structured data, no GA. The app is a **client-rendered Vite SPA** (no SSR) — `JobDetailPage` renders `/jobs/:id` client-side.

## Patterns to Follow

- **Migrations**: timestamped SQL in `supabase/migrations/`, additive, idempotent (`if not exists`, `drop … if exists`). Status changes = drop+recreate check constraint (see `20260328000000_split_job_type_arrangement.sql`).
- **Email**: clone `supabase/functions/notify-employer-application/index.ts` (Bearer-secret auth, branded green HTML, `escapeHtml`, employer lookup via `employers.user_id = jobs.employer_id`, SMTP send). New trigger/cron functions follow `20260423000000_harden_notification_triggers.sql` (vault read in its own `BEGIN…EXCEPTION`, null-check, guarded `net.http_post`).
- **Privileged self-service writes**: `SECURITY DEFINER` RPC scoped by `auth.uid()` (see `update_employer_profile`) — the model for a `renew_job` RPC.
- **Shared constants**: `src/constants/jobStyles.ts`; status styling is a local `STATUS_STYLES` map per page.
- **Admin email source**: `site_settings.approval_notification_email` (reuse, don't add a new key).

## Desired End State

1. **Keyword search** (HomePage + MapPage) matches `title + company_name + description + assigned tag names`, consistent across both pages. MapPage query adds `description` to its select.
2. **Map** uses the geocode result's `boundingbox` to fit the view — state queries show the whole state, city queries stay city-level — replacing the fixed `zoom 10`. Radius selection still wins when set.
3. **Markers** open their popup on **hover** (desktop) / **tap** (mobile). Co-located jobs open a single popup **listing all jobs at that point** (each linking to `/jobs/:id`) — restoring the multi-job behavior Jess liked — instead of the click-to-spread/zoom.
4. **Expiration**: `jobs.expires_at` (default `now()+30d`). A daily **pg_cron** job flips `active→expired` past expiry and fires batched emails via a new `job-lifecycle-emails` Edge Function: **day-28 reminder** (employer + admin) and **day-30 expired** (employer + admin lead alert). Employers see "Expires in N days"/"Expired" and a **Renew (30 days)** button (a `renew_job` RPC resetting `expires_at`, status, and the notify flags). `expired` is added to the status constraint, `STATUS_STYLES`, and the dashboard select.
5. **GA4**: gtag in `index.html` with `send_page_view:false` + a `usePageTracking` hook firing `page_view` on `useLocation` change. Measurement ID via `VITE_GA_ID`.
6. **SEO (Phase A)**: `JobDetailPage` injects `JobPosting` JSON-LD (via `react-helmet-async`) **only for active, unexpired jobs** — with `validThrough = expires_at`, `datePosted`, `hiringOrganization`, `jobLocation` (or `TELECOMMUTE` + `applicantLocationRequirements` for remote), `employmentType`, `baseSalary` when present. A Supabase Edge Function serves a **dynamic `sitemap.xml`** of active+unexpired jobs. **Phase B (flagged, not built): crawler-facing prerender + real `410` for dead jobs + Indexing API.**

## Design Decisions

- **`expired` is a DB check-constraint enum, not a lookup table** — matches the existing `status` pattern; values are stable and code-coupled (filters, styles).
- **Expiration scheduler = pg_cron** calling one `security definer` function that marks rows idempotently (`reminder_sent_at`, `expiry_notified_at` via `UPDATE…RETURNING` CTE) and sends **one batched `net.http_post`**; the Edge Function loops and emails. Daily at a fixed UTC time (~mid-morning ET; DST drift acceptable).
- **Renewal via dashboard login** (brainstorm decision) — `renew_job(p_job_id)` RPC ownership-checked by `auth.uid()`, resets `expires_at = now()+30d`, `status='active'`, and nulls the notify flags. Renewable anytime.
- **Marker hover**: use react-leaflet `eventHandlers` (`mouseover`/`mouseout`) to open popups; keep click as a fallback and tap for mobile. Drop the fly-to-zoom-15 spread.
- **Map zoom via `boundingbox`**: thread Nominatim's `boundingbox` through `LocationAutocomplete.onSelect` and the `?location=` fetch; `MapView` does `flyToBounds`. Generalizes city vs state without special-casing.
- **SEO expiry coupling**: expiring a job must stop public exposure of its `JobPosting` markup. Since a static SPA can't return real `404/410`, `JobDetailPage` renders a "no longer active" state and **omits the JSON-LD** for non-active jobs; the dynamic sitemap excludes them. Real `410` + Indexing API is explicitly **Phase B**.
- **GA4 + JobPosting URLs are domain-dependent** — parameterize the site origin (env/constant), don't hardcode, because the production domain is still unconfirmed (`index.html` says `associationcareers.com`, footer/emails say `associationcareers.realestate`).

## Resolved Questions

1. **First-cron email blast (backfill):** DECIDED — `expires_at = created_at + 30d`, but the migration **pre-stamps `reminder_sent_at` + `expiry_notified_at` and sets `status='expired'` on jobs whose computed `expires_at` is already past**, so the first cron run silently expires them with **no email**. New/future expirations follow the normal lifecycle.
3. **Sitemap mechanism:** DECIDED — dynamic Supabase Edge Function emitting `sitemap.xml` (active + unexpired jobs, real `lastmod`, ~1h cache); `robots.txt` points to it.

## Still-Pending (parameterized, non-blocking)

2. **Production domain:** `associationcareers.com` vs `associationcareers.realestate` vs the two Jess has registered (pending email). Build behind a single site-origin constant/env so JSON-LD `url`, canonical, and sitemap `loc` flip in one place once confirmed.
4. **GA4 Measurement ID** (`G-XXXXXXX`): pending from Jess — ship the hook behind `VITE_GA_ID`; analytics activates once the ID is set.

## Testing Strategy

- **Search/zoom/markers:** manual — search "CEO"/"Finance" returns tag-only matches on both pages; "California" shows the whole state; hovering a single pin and a co-located badge shows popup/list; mobile tap works.
- **Expiration:** manually set a test job's `expires_at` to the past, invoke `run_daily_job_maintenance()` directly (and/or the Edge Function with a sample batch), confirm status flip + exactly-once emails (re-run = no duplicates) + correct employer/admin recipients; click Renew and confirm reset.
- **SEO/GA:** Google Rich Results Test on an active job (passes) and an expired job (no JobPosting markup); fetch the sitemap Edge Function and confirm only active+unexpired jobs; GA4 Realtime shows a `page_view` per route change.
- No automated test framework is configured in this repo; verification is manual + the existing `tsc`/`vite build` checks.
