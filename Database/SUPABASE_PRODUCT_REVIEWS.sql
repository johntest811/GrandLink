-- Product Reviews / Ratings (Supabase)
-- Creates a public-read reviews table where only users who completed the product
-- (via user_items.order_status/status = 'completed') can write a review.

create extension if not exists "pgcrypto";

-- 1) Table
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  -- comment is optional; if provided it must be non-empty after trim and <= 2000 chars
  comment text check (comment is null or (char_length(trim(comment)) > 0 and char_length(comment) <= 2000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

-- Migration helpers (safe to run after the table already exists)
alter table public.product_reviews
  alter column comment drop not null;

do $$
declare
  c record;
begin
  -- Drop any previous NOT-NULL/required-comment check constraints that reference the comment column.
  for c in (
    select conname
    from pg_constraint
    where conrelid = 'public.product_reviews'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%comment%'
      and pg_get_constraintdef(oid) ilike '%char_length%'
  ) loop
    execute format('alter table public.product_reviews drop constraint if exists %I', c.conname);
  end loop;

  -- Recreate a single normalized constraint for optional comments.
  execute 'alter table public.product_reviews add constraint product_reviews_comment_optional_check check (comment is null or (char_length(trim(comment)) > 0 and char_length(comment) <= 2000))';
exception
  when duplicate_object then
    -- constraint already exists
    null;
end $$;

create index if not exists idx_product_reviews_product_id_created_at
  on public.product_reviews(product_id, created_at desc);

create index if not exists idx_product_reviews_user_id
  on public.product_reviews(user_id);

-- 2) updated_at trigger
create or replace function public.set_product_reviews_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_product_reviews_updated_at on public.product_reviews;
create trigger trg_product_reviews_updated_at
before update on public.product_reviews
for each row execute function public.set_product_reviews_updated_at();

-- 3) RLS
alter table public.product_reviews enable row level security;

-- Public can read reviews (including anon users)
drop policy if exists "product_reviews_select_public" on public.product_reviews;
create policy "product_reviews_select_public"
  on public.product_reviews
  for select
  using (true);

-- Authenticated users can insert ONLY if they completed the product.
-- We accept completed rows in user_items where:
-- - user_id matches auth.uid()
-- - product_id matches the review
-- - item_type indicates an actual purchase/reservation (order OR reservation)
-- - order_status OR status is 'completed'
-- If your schema uses different values, adjust the check accordingly.
drop policy if exists "product_reviews_insert_completed_buyers" on public.product_reviews;
create policy "product_reviews_insert_completed_buyers"
  on public.product_reviews
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.user_items ui
      where ui.user_id = auth.uid()
        and ui.product_id = product_reviews.product_id
        and ui.item_type in ('order', 'reservation')
        and lower(coalesce(ui.order_status, ui.status, '')) = 'completed'
    )
  );

-- Owner can update their own review (optional but useful for edits)
drop policy if exists "product_reviews_update_owner" on public.product_reviews;
create policy "product_reviews_update_owner"
  on public.product_reviews
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Owner can delete their own review (optional)
drop policy if exists "product_reviews_delete_owner" on public.product_reviews;
create policy "product_reviews_delete_owner"
  on public.product_reviews
  for delete
  to authenticated
  using (user_id = auth.uid());
