# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start Next.js dev server (Next 16 uses Turbopack by default)
npm run build        # Production build
npm run lint         # ESLint

# Testing
npm run test                                        # Run all tests
node --import tsx --test tests/path/to/file.test.ts # Run a single test file

# Database
npm run db:generate  # Generate Drizzle migrations from schema changes
npm run db:migrate   # Apply pending migrations
npm run db:push      # Push schema directly (dev only)
npm run db:seed      # Seed initial data
npm run db:studio    # Open Drizzle Studio GUI

# Ops
npm run supabase:cron:deploy  # Deploy Supabase scheduled cron jobs
```

## Architecture

VidClaw v2 is a Next.js 16 (App Router) SaaS for AI video generation. Users submit generation tasks, the app dispatches them to external video providers, and polls for results. Credits are consumed on submission and refunded on failure.

### Core domain modules (`src/lib/`)

Each major domain has its own `CLAUDE.md` with detailed architecture notes:

- **`tasks/`** — Task lifecycle split into four independent responsibility lines: reconciliation (`reconciliation.ts`), downloads/ZIP (`downloads.ts`), expiry cleanup (`expiry.ts`), and async progression (`runner.ts`). Batch submission is rate-throttled through `batch-queue.ts` (2-second inter-request cadence, windowed submit count per round). See `src/lib/tasks/CLAUDE.md`.

- **`video/`** — Provider adapter pattern. `service.ts` resolves the model and dispatches to a provider adapter; all provider-specific protocol details (URLs, field names, status words) are isolated in adapters under `src/lib/video/providers/` (currently `plato.ts`, `yunwu.ts`, `dashscope.ts`, `grok2api.ts`). Failure classification lives in `providers/shared.ts`. See `src/lib/video/CLAUDE.md`.

- **`image-edit/`** — Async image transformation pipeline (product images → 9:16 white background). Runs as a separate worker from the video maintenance runner. See `src/lib/image-edit/CLAUDE.md`.

- **`models/`** — DB-driven model registry with capabilities (`video_generation`, `image_edit`, `script_generation`). Models carry per-model API keys, default params, and credits-per-generation. See `src/lib/models/CLAUDE.md`.

- **`payments/`** — Alipay integration, with Stripe being added (see `src/app/api/payments/stripe/`). Payment orders flow: pending → paid → credits granted. See `src/lib/payments/CLAUDE.md`.

- **`generate/`** — Orchestrates task creation: validates input, deducts credits, inserts task rows, and enqueues for processing.

- **`db/schema.ts`** — Single source of truth for all tables and enums. Key tables: `users`, `models`, `tasks`, `taskGroups`, `taskSlots`, `taskItems`, `creditTxns`, `paymentOrders`, `userAssets`, `assetTransformJobs`.

### Task state machine

```
pending → analyzing → generating → polling → done
                                           ↘ failed (triggers refund)
scheduled → (clock fires) → pending
```

`taskSlots` track per-video delivery promises within a task; `taskItems` track individual provider attempts per slot. Fulfilled slot = one successful video delivered.

### API routes (`src/app/api/`)

- `/api/generate` — Create single task; `/api/generate/batch` — Create task group
- `/api/tasks/refresh` — Poll provider status (called from client)
- `/api/internal/tasks/tick` — Cron-triggered maintenance runner. Requires `Authorization: Bearer $CRON_SECRET` (Vercel Cron) or `$INTERNAL_TICK_SECRET` (manual/internal trigger).
- `/api/cron/timeout` — Timeout + refund stale tasks
- `/api/admin/*` — Admin-only management endpoints

### Authentication

Supabase Auth with SSR adapter. Middleware at `src/lib/supabase/middleware.ts` protects all `(dashboard)` routes. Server components use `createServerClient`; API routes use `createServiceClient` (bypasses RLS).

### State management

Zustand store at `src/stores/generate.ts` holds the generation form state (model, params, mode, assets). The store feeds `src/app/(dashboard)/generate/page.tsx` and the `GenerateFormPanels` component tree.

## Database migrations

Migration SQL files live in `drizzle/`. See `drizzle/CLAUDE.md` for the migration strategy — notably: always `db:generate` after schema changes, never hand-edit migration files.

## Tests

Tests use Node.js built-in `node:test` + `node:assert/strict`. No external test framework. Test files mirror the `src/lib/` structure under `tests/`.

## Key constraints

- Provider adapters must not leak into task domain or page layer — all vendor protocol details stay in `providers/`.
- Batch task submission must always go through the window throttle in `batch-queue.ts`; never submit a whole group at once from a route handler.
- Refund logic belongs only in reconciliation/timeout modules — not in download or expiry cleanup.
- `runner.ts` is video-domain only; image-edit async jobs use a separate worker path.
