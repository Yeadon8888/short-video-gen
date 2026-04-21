-- Enable Row Level Security (RLS) on all tables.
--
-- WHY: Defense in depth. Our current backend connects as `postgres` /
--   `service_role`, both of which bypass RLS, so enabling these policies
--   does NOT change any existing API behavior. The point is: the moment
--   anyone (a) uses a Supabase JS client query from the frontend, (b)
--   writes a Supabase Edge Function, or (c) hooks up a Supabase MCP that
--   runs as `authenticated`, RLS is the only barrier between users and
--   each other's data. Not having it is a latent P0.
--
-- POLICY STYLE: We use `(select auth.uid())` rather than `auth.uid()`
--   directly — per Supabase docs this lets PG cache the result per query
--   instead of re-evaluating per row.
--
-- AUTHENTICATED ROLE ONLY: We only add policies for the `authenticated`
--   role. `anon` gets no policies (i.e. no access) because we never expose
--   anon API routes to these tables. `service_role` / `postgres` bypass
--   RLS automatically — no policy needed.
--
-- SERVICE-OWNED TABLES (models, system_config, announcements,
--   stripe_events): RLS enabled but no authenticated policies, meaning
--   only server-side code can read/write them. This matches current intent.
--
-- IDEMPOTENT: every policy uses drop-if-exists + create. `enable row level
--   security` is naturally idempotent (re-enabling is a no-op).

-- ─── Users: root owner table ─────────────────────────────────────────────

alter table "public"."users" enable row level security;

drop policy if exists "users_select_self" on "public"."users";
create policy "users_select_self" on "public"."users"
  for select to authenticated
  using ((select auth.uid()) = auth_id);

-- No insert/update/delete policies for authenticated — user rows are
-- managed by a server-side flow (Supabase Auth webhook → service role).

-- ─── User-owned content tables (user_id → users.id) ──────────────────────

alter table "public"."tasks" enable row level security;
drop policy if exists "tasks_select_own" on "public"."tasks";
create policy "tasks_select_own" on "public"."tasks"
  for select to authenticated
  using ((select auth.uid()) = (select auth_id from "public"."users" where id = user_id));

alter table "public"."task_groups" enable row level security;
drop policy if exists "task_groups_select_own" on "public"."task_groups";
create policy "task_groups_select_own" on "public"."task_groups"
  for select to authenticated
  using ((select auth.uid()) = (select auth_id from "public"."users" where id = user_id));

alter table "public"."user_assets" enable row level security;
drop policy if exists "user_assets_select_own" on "public"."user_assets";
create policy "user_assets_select_own" on "public"."user_assets"
  for select to authenticated
  using ((select auth.uid()) = (select auth_id from "public"."users" where id = user_id));

alter table "public"."credit_txns" enable row level security;
drop policy if exists "credit_txns_select_own" on "public"."credit_txns";
create policy "credit_txns_select_own" on "public"."credit_txns"
  for select to authenticated
  using ((select auth.uid()) = (select auth_id from "public"."users" where id = user_id));

alter table "public"."payment_orders" enable row level security;
drop policy if exists "payment_orders_select_own" on "public"."payment_orders";
create policy "payment_orders_select_own" on "public"."payment_orders"
  for select to authenticated
  using ((select auth.uid()) = (select auth_id from "public"."users" where id = user_id));

alter table "public"."asset_transform_jobs" enable row level security;
drop policy if exists "asset_transform_jobs_select_own" on "public"."asset_transform_jobs";
create policy "asset_transform_jobs_select_own" on "public"."asset_transform_jobs"
  for select to authenticated
  using ((select auth.uid()) = (select auth_id from "public"."users" where id = user_id));

alter table "public"."gallery_items" enable row level security;
drop policy if exists "gallery_items_select_own" on "public"."gallery_items";
create policy "gallery_items_select_own" on "public"."gallery_items"
  for select to authenticated
  using ((select auth.uid()) = (select auth_id from "public"."users" where id = user_id));

-- ─── Task child tables (scoped via parent task / group ownership) ────────

alter table "public"."task_items" enable row level security;
drop policy if exists "task_items_select_own" on "public"."task_items";
create policy "task_items_select_own" on "public"."task_items"
  for select to authenticated
  using (
    (select auth.uid()) = (
      select auth_id from "public"."users" u
      join "public"."tasks" t on t.user_id = u.id
      where t.id = task_id
    )
  );

alter table "public"."task_slots" enable row level security;
drop policy if exists "task_slots_select_own" on "public"."task_slots";
create policy "task_slots_select_own" on "public"."task_slots"
  for select to authenticated
  using (
    (select auth.uid()) = (
      select auth_id from "public"."users" u
      join "public"."tasks" t on t.user_id = u.id
      where t.id = task_id
    )
  );

-- ─── Service-owned tables (RLS on, no authenticated policy) ──────────────
--
-- Enabling RLS without any SELECT policy means `authenticated` role sees
-- zero rows. Only `service_role` / `postgres` (which bypass RLS) can
-- access these. This is the secure-by-default posture we want for tables
-- that were never meant to be user-facing.

alter table "public"."models" enable row level security;
alter table "public"."system_config" enable row level security;
alter table "public"."announcements" enable row level security;
alter table "public"."stripe_events" enable row level security;
