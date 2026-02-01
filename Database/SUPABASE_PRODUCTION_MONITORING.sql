-- Production Monitoring for Glass/Aluminum Fabrication
-- Schema changes for:
-- - Linking tasks to orders (user_items) and employees (admins)
-- - Capturing employee progress submissions + leader approval (task_updates)
--
-- Paste into Supabase SQL Editor and run.

begin;

-- 1) Extend existing tasks table to link to orders/products/admin employees
alter table public.tasks
  add column if not exists user_item_id uuid null,
  add column if not exists product_id uuid null,
  add column if not exists assigned_admin_id uuid null;

-- Foreign keys (safe defaults: set null on delete)
DO $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_user_item_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_user_item_id_fkey
      foreign key (user_item_id) references public.user_items(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tasks_product_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_product_id_fkey
      foreign key (product_id) references public.products(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tasks_assigned_admin_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_assigned_admin_id_fkey
      foreign key (assigned_admin_id) references public.admins(id)
      on delete set null;
  end if;
end $$;

create index if not exists tasks_user_item_id_idx on public.tasks(user_item_id);
create index if not exists tasks_assigned_admin_id_idx on public.tasks(assigned_admin_id);


-- 1b) Order team members: lets a team leader create a group of employees per order
-- This is the "production group" for a specific user_items order.
create table if not exists public.order_team_members (
  id uuid primary key default gen_random_uuid(),
  user_item_id uuid not null,
  admin_id uuid not null,
  created_by_admin_id uuid null,
  created_at timestamptz not null default now(),

  constraint order_team_members_user_item_id_fkey
    foreign key (user_item_id) references public.user_items(id)
    on delete cascade,

  constraint order_team_members_admin_id_fkey
    foreign key (admin_id) references public.admins(id)
    on delete cascade,

  constraint order_team_members_created_by_admin_id_fkey
    foreign key (created_by_admin_id) references public.admins(id)
    on delete set null
);

create unique index if not exists order_team_members_unique
  on public.order_team_members(user_item_id, admin_id);

create index if not exists order_team_members_user_item_id_idx
  on public.order_team_members(user_item_id);

create index if not exists order_team_members_admin_id_idx
  on public.order_team_members(admin_id);


-- 2) Task updates table: employee submits progress (text + images), leader approves/rejects.
create table if not exists public.task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id bigint not null,

  submitted_by_admin_id uuid null,
  submitted_by_name text null,

  description text null,
  image_urls text[] null,

  status text not null default 'submitted',
  is_final_qc boolean not null default false,

  approved_by_admin_id uuid null,
  approved_at timestamptz null,

  rejected_at timestamptz null,
  rejection_reason text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint task_updates_task_id_fkey
    foreign key (task_id) references public.tasks(id)
    on delete cascade,

  constraint task_updates_submitted_by_admin_id_fkey
    foreign key (submitted_by_admin_id) references public.admins(id)
    on delete set null,

  constraint task_updates_approved_by_admin_id_fkey
    foreign key (approved_by_admin_id) references public.admins(id)
    on delete set null,

  constraint task_updates_status_check
    check (status in ('submitted','approved','rejected'))
);

create index if not exists task_updates_task_id_idx on public.task_updates(task_id);
create index if not exists task_updates_status_idx on public.task_updates(status);
create index if not exists task_updates_created_at_idx on public.task_updates(created_at);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'task_updates_set_updated_at'
  ) then
    create trigger task_updates_set_updated_at
    before update on public.task_updates
    for each row execute function public.set_updated_at();
  end if;
end $$;

commit;


-- 3) Storage bucket note (not SQL):
-- The admin/employee UI uploads progress images to a bucket named: order-progress
-- and reads them via public URLs.
-- In Supabase Dashboard:
-- - Storage → Buckets → New bucket → name: order-progress
-- - If you keep using public URLs (getPublicUrl), set bucket to PUBLIC.
--   If you prefer PRIVATE, switch code to use signed URLs instead.


-- 4) Optional (recommended) RLS hardening (ONLY enable if your apps use Supabase Auth)
-- IMPORTANT: The current admin app can use a service role key client-side,
-- which bypasses RLS. If you enable RLS without proper auth mapping, anon clients will be blocked.
--
-- -- Example:
-- -- alter table public.task_updates enable row level security;
-- -- alter table public.tasks enable row level security;
--
-- -- Then create policies based on auth.uid() and your own mapping of admins/users.
