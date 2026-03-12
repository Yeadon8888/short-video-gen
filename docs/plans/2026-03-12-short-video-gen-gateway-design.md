# Short Video Gen Gateway Refactor

## Goal

Replace the broken Yunwu video generation path with the newer Plato Sora2 path, remove invite-code login from the web app, and stop exposing direct R2 credentials inside the app. The web app and CLI should both use the same simpler deployment model:

- Gemini for script generation
- Plato relay for video generation
- Cloudflare Worker upload gateway for reference images

## Recommended Architecture

Use a thin orchestration layer in Next.js and move integration logic into dedicated modules.

- `web/lib/video/plato.ts`
  Handles task creation and polling against `POST /v2/videos/generations` and `GET /v2/videos/generations/{task_id}`.
- `web/lib/storage/gateway.ts`
  Talks only to a Cloudflare Worker upload gateway using `UPLOAD_API_URL` and `UPLOAD_API_KEY`.
- `web/lib/workspace.ts`
  Provides anonymous browser-scoped workspace IDs instead of invite-code login.
- `workers/upload-gateway/*`
  Owns the R2 bucket binding and exposes upload/list/delete/public-file endpoints.

This keeps bucket credentials out of the web app and removes the old auth/session burden.

## Data Flow

1. Browser generates or reuses a local workspace ID.
2. Browser uploads reference images through `/api/images` with `x-workspace-id`.
3. Next.js route proxies uploads to the Worker gateway.
4. Next.js route `/api/generate` lists workspace images from the gateway.
5. Gemini generates a structured script.
6. Plato Sora2 creates async video tasks.
7. The route polls until success/failure and streams progress back to the browser.

## Why This Design

Compared to the previous design:

- Fewer secrets in the app
  Only `GEMINI_API_KEY`, `VIDEO_API_KEY`, `UPLOAD_API_URL`, and `UPLOAD_API_KEY` are needed.
- Better separation
  Video provider logic, storage logic, and UI/session logic are no longer mixed together.
- Easier Cloudflare operations
  R2 stays behind a Worker binding instead of manual SigV4 logic inside app code.
- No login wall
  The app becomes shareable without maintaining invite codes or JWT session state.

## Risks

- Plato text-only generation support is weaker than the old Yunwu path, so image-backed generation is the safest mode.
- Anonymous workspaces mean uploads are browser-local, not account-global.
- Cloudflare Worker deployment still requires Wrangler auth and a bound R2 bucket.

## Validation

- TypeScript/Next build should validate the web refactor.
- `python3 -m py_compile scripts/generate.py` validates CLI syntax.
- Wrangler local validation should confirm the Worker config and entrypoint.
