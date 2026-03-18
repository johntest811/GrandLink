-- Production Update Notifications (Customer in-app notifications)
--
-- Goal: When a team-leader approves a production update and it gets written into
-- user_items.meta.production_updates, automatically notify the customer.
--
-- Paste into Supabase SQL editor and run.

begin;

-- 1) Expand allowed user_notifications.type values (add 'production_update', keep existing)
alter table if exists public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table if exists public.user_notifications
  add constraint user_notifications_type_check
  check (
    type = any (
      array[
        'new_product'::text,
        'stock_update'::text,
        'order_status'::text,
        'payment_request'::text,
        'production_update'::text,
        'general'::text
      ]
    )
  );

-- 2) Trigger function: detect newly published production update and insert notification
create or replace function public.notify_customer_on_production_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_updates jsonb;
  old_updates jsonb;
  new_len int;
  old_len int;
  new_update jsonb;
  msg text;
  title text;
  should_notify boolean;
  prefs record;
begin
  -- Only run for real rows
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Production updates are stored in meta.production_updates (json array)
  new_updates := coalesce(new.meta->'production_updates', '[]'::jsonb);
  old_updates := coalesce(old.meta->'production_updates', '[]'::jsonb);

  -- If no change, exit
  if new_updates = old_updates then
    return new;
  end if;

  new_len := jsonb_array_length(new_updates);
  old_len := jsonb_array_length(old_updates);

  -- Only notify when an update is added
  if new_len <= old_len then
    return new;
  end if;

  -- App prepends newest update at index 0: [new, ...prev]
  new_update := new_updates->0;
  if new_update is null then
    return new;
  end if;

  -- Respect notification preferences (reuse order_status_notifications as the closest setting)
  should_notify := true;
  begin
    select * into prefs
    from public.user_notification_preferences
    where user_id = new.user_id
    limit 1;

    if found and prefs.order_status_notifications is false then
      should_notify := false;
    end if;
  exception when others then
    -- If prefs table isn't available in this environment, default to notify
    should_notify := true;
  end;

  if not should_notify then
    return new;
  end if;

  title := 'Production Update';
  msg := coalesce(nullif(new_update->>'description', ''), 'A new production update was posted.');

  -- Keep message short
  if length(msg) > 160 then
    msg := left(msg, 157) || '...';
  end if;

  insert into public.user_notifications(
    user_id,
    title,
    message,
    type,
    metadata,
    action_url,
    product_id,
    order_id,
    is_read,
    created_at
  ) values (
    new.user_id,
    title,
    msg,
    'production_update',
    jsonb_build_object(
      'user_item_id', new.id,
      'task_update_id', coalesce(new_update->>'task_update_id', new_update->>'id'),
      'task_name', new_update->>'task_name'
    ),
    '/profile/order?openProgress=' || new.id,
    new.product_id,
    new.id,
    false,
    now()
  );

  return new;
end;
$$;

-- 3) Trigger: after updates to user_items
--    Only fire when meta changes (minimizes overhead)
drop trigger if exists trg_notify_customer_on_production_update on public.user_items;

create trigger trg_notify_customer_on_production_update
after update of meta on public.user_items
for each row
execute function public.notify_customer_on_production_update();

commit;
