# Search & Filter Restructure

**Date:** 2026-03-28
**Source:** Mar 26 meeting with Jess Biller
**Status:** Brainstorm

## What We're Building

Split the current single `job_type` field into two separate concepts and simplify the homepage search bar:

1. **Job Type** (employment type): Full-time, Part-time, Contract
2. **Work Arrangement** (location flexibility): On-site, Remote, Hybrid

### Homepage Search Bar (simplified)
- **Before:** Keyword | Location | All Types (4 options) | All Categories | Search
- **After:** Keyword | Location | Remote (On-site/Remote/Hybrid) | Search

Categories and Job Type filters move to the MapPage only.

### MapPage / Main Search (full filters)
- Location + Radius
- Keyword
- Job Type (Full-time / Part-time / Contract)
- Work Arrangement (On-site / Remote / Hybrid)
- Categories

## Why This Approach

- Homepage was getting cramped with 4 filter fields (Jess noted categories getting cut off)
- Work arrangement (remote/hybrid/on-site) is the most common first filter job seekers use
- Separating job type from work arrangement matches industry standard (ZipRecruiter, Indeed)
- Keeps homepage clean while MapPage offers deep filtering

## Key Decisions

1. **Homepage shows 3 search fields** - Keyword, Location, Work Arrangement only
2. **Two separate DB fields** - `job_type` for employment type, `work_arrangement` for location flexibility
3. **Popular Categories stays** - Already dynamic (top 4 by job count), remains below search bar
4. **MapPage gets all filters** - Types + Work Arrangement + Categories + Location/Radius

## Schema Changes

### New column: `work_arrangement`
- Type: text (or enum)
- Values: `on-site`, `remote`, `hybrid`
- Default: `on-site`

### Revert `job_type` to employment types
- Values: `full-time`, `part-time`, `contract`
- Default: `full-time`

### Migration path
The existing migration (`20260326000001_update_job_types.sql`) already converted old full-time/part-time values to `in-office`. This means we've lost the original employment type for existing rows. New migration needs to:
1. Add `work_arrangement` column
2. Map current `job_type` values to `work_arrangement` (remote->remote, hybrid->hybrid, in-office->on-site, contract->on-site)
3. Set `job_type` to `full-time` as default for all migrated rows (contract stays contract)
4. Update the enum/check constraint on `job_type`

## Files to Change

- `supabase/migrations/` - New migration for schema changes
- `src/types/index.ts` - Update JobPosting interface
- `src/pages/HomePage.tsx` - Simplify search bar (3 fields), remove tag filter
- `src/pages/MapPage.tsx` - Add work_arrangement filter alongside existing type filter
- `src/pages/PostJobPage.tsx` - Two dropdowns (job type + work arrangement)
- `src/pages/JobDetailPage.tsx` - Display both badges
- `src/components/JobCard.tsx` - Display work arrangement badge (primary) + job type
- `src/pages/AdminPage.tsx` - Job listing may need to show both fields

## Resolved Questions

1. **Homepage category cards** - Keep current behavior: clicking a Popular Category navigates to `/map?tag=<id>`. No client-side tag filtering needed on homepage since the dropdown is removed.

2. **Migration strategy** - Layer a new migration on top of the existing `20260326000001_update_job_types.sql`. Don't replace it.
