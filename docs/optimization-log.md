# Optimization Log

This file records short, practical optimization notes for VidClaw v2.

Before doing new performance, cost, reliability, architecture, or deployment optimization work, read this file first. After shipping an optimization, add a short entry so future maintainers do not repeat the same investigation.

## Entry Format

```md
## YYYY-MM-DD - Short Title

- Trigger: What symptom or request led to this work.
- Change: What changed, in one or two bullets.
- Effect: What should improve.
- Verify: What was checked.
- Watch: Any follow-up risk or tradeoff.
```

## 2026-05-08 - Reduce Vercel Transfer And CPU Usage

- Trigger: Vercel reported Fast Origin Transfer and Fluid Active CPU quota pressure.
- Change: Replaced Vercel ZIP/media proxy downloads with direct file URL downloads for task videos and user assets.
- Change: Fixed task list polling so it depends on active-task state only, and pauses when the tab is hidden.
- Change: Disabled heavy Supabase cron jobs for gallery thumbnail backfill and asset transform drain; made them opt-in in `scripts/deploy-supabase-cron.ts`.
- Change: Added CDN cache headers for `/api/gallery`; removed root `next/font/google` build-time dependency.
- Effect: Lower Vercel origin transfer, lower Function CPU, fewer repeated task refresh calls, more stable production builds.
- Verify: `npx tsc --noEmit --pretty false`, targeted ESLint, `npm run build`, production deploy, `/api/health` 200, Vercel logs clean, `/api/gallery` cache HIT.
- Watch: Batch downloads are now multiple direct file downloads instead of one ZIP. Gallery thumbnails and background asset transform draining are weaker until moved to a dedicated worker or explicitly re-enabled.

## 2026-05-08 - Slim Task List Payloads

- Trigger: Supabase project usage showed ~118 GB Egress while videos are hosted outside Supabase.
- Change: Task history page and `/api/tasks/refresh` now select only list-summary fields instead of full task rows.
- Change: Removed direct result URL links from task cards; detail pages and download APIs still load full result URLs on demand.
- Effect: Lower Supabase DB egress during task-list loads and active polling.
- Verify: Compared a representative 50-task payload: ~80 KB full rows vs ~20 KB slim rows. Ran targeted ESLint and TypeScript.
- Watch: Users now open task detail or use the download button for per-video links from the task list.

## 2026-05-08 - Restore ZIP Downloads Without Vercel Proxying

- Trigger: Direct-download mitigation caused batch video downloads to open many browser tabs instead of one archive.
- Change: Task and task-group download buttons now build ZIP files in the browser from direct file URLs.
- Effect: Restores one-click ZIP download while keeping large media transfer off Vercel Functions.
- Verify: Targeted ESLint, TypeScript, and `npm run build`.
- Watch: Browser-side ZIP creation uses client memory; very large batches may need a streaming ZIP worker later. Third-party video URLs without CORS fall back to server ZIP, which uses Vercel transfer.
