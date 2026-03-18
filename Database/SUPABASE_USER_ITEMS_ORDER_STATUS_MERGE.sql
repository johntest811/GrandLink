-- Merge user_items.order_progress into user_items.order_status
-- Goal: Keep ONE canonical status column (order_status) while remaining backward compatible.
--
-- Safe rollout plan:
-- 1) Run this SQL (backfills + trigger).
-- 2) Deploy code that ONLY reads/writes order_status (this repo change does that).
-- 3) OPTIONAL: after verifying nothing uses order_progress anymore, you can drop the column.

begin;

-- 1) Backfill order_status from order_progress/status (orders only)
update public.user_items
set order_status = coalesce(order_status, order_progress, status)
where item_type = 'order'
  and order_status is null;

-- 2) Optional backfill for older UI code that still reads order_progress
--    (safe even if you later drop the column)
update public.user_items
set order_progress = coalesce(order_progress, order_status, status)
where item_type = 'order'
  and order_progress is null;

-- 3) Keep order_status/order_progress in sync during transition
--    If you later DROP order_progress, DROP this trigger+function first.
create or replace function public.sync_user_items_order_status_progress()
returns trigger
language plpgsql
as $$
begin
  -- Normalize empties
  if new.order_status is not null and btrim(new.order_status) = '' then
    new.order_status := null;
  end if;
  if new.order_progress is not null and btrim(new.order_progress) = '' then
    new.order_progress := null;
  end if;

  -- Prefer order_status as canonical.
  if new.order_status is null then
    new.order_status := coalesce(new.order_progress, new.status);
  end if;

  -- Keep legacy field aligned for any older clients.
  if new.order_progress is null then
    new.order_progress := coalesce(new.order_status, new.status);
  end if;

  -- If one changed, mirror it.
  if tg_op = 'UPDATE' then
    if new.order_status is distinct from old.order_status then
      new.order_progress := new.order_status;
    elsif new.order_progress is distinct from old.order_progress then
      new.order_status := new.order_progress;
    end if;
  end if;

  -- Also keep the generic status aligned (many parts of the codebase still use it).
  if new.status is null then
    new.status := new.order_status;
  end if;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'trg_sync_user_items_order_status_progress'
  ) then
    drop trigger trg_sync_user_items_order_status_progress on public.user_items;
  end if;

  create trigger trg_sync_user_items_order_status_progress
  before insert or update on public.user_items
  for each row
  execute function public.sync_user_items_order_status_progress();
end;
$$;

commit;

-- OPTIONAL final step (run later, ONLY after confirming you no longer need order_progress):
-- alter table public.user_items drop column if exists order_progress;
-- drop trigger if exists trg_sync_user_items_order_status_progress on public.user_items;
-- drop function if exists public.sync_user_items_order_status_progress();
