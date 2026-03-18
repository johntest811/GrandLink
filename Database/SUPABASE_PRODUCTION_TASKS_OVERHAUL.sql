-- Production Tasks Overhaul (Admin Tasks + Employee Progress + Customer Order Progress)
-- Paste into Supabase SQL editor and run.
-- Safe-ish to re-run (uses IF NOT EXISTS where possible).

-- 1) task_updates: add missing flags used by the app
alter table if exists public.task_updates
  add column if not exists visible_to_customer boolean not null default false;

-- Optional: make sure image_urls is a text[] (skip if already correct).
-- If your column is already text[] this will be a no-op.
-- If this fails due to incompatible existing data, comment it out and keep image_urls as-is.
-- alter table if exists public.task_updates
--   alter column image_urls type text[] using image_urls::text[];

-- 2) Helpful indexes
create index if not exists idx_tasks_user_item_id on public.tasks(user_item_id);
create index if not exists idx_tasks_assigned_admin_id on public.tasks(assigned_admin_id);
create index if not exists idx_task_updates_task_id_status on public.task_updates(task_id, status);
create index if not exists idx_order_team_members_user_item_id on public.order_team_members(user_item_id);

-- 3) (Optional) Data hygiene: mark old approved updates as visible to customer.
-- Uncomment if you want historical approved updates to show up in the website order progress.
-- update public.task_updates set visible_to_customer = true where status = 'approved';
