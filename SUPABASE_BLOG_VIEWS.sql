-- GrandLink Blog Views (Supabase)
-- Goal: count unique blog viewers, including guests (no account).
--
-- How it works:
-- - Website calls a server API route that upserts into blog_views.
-- - Logged-in users use user_id; guests use visitor_id stored in localStorage.
-- - The unique constraints ensure repeat visits don't inflate counts.

create extension if not exists pgcrypto;

create table if not exists public.blog_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  blog_id uuid not null references public.blogs(id) on delete cascade,

  -- If logged in
  user_id uuid,

  -- If guest
  visitor_id uuid,

  -- Optional debug fields
  user_agent text,

  constraint blog_views_exactly_one_identity
    check (
      (user_id is not null and visitor_id is null)
      or
      (user_id is null and visitor_id is not null)
    )
);

-- Uniqueness: one view per user per blog, and one view per visitor per blog
create unique index if not exists blog_views_unique_user
  on public.blog_views (blog_id, user_id)
  where user_id is not null;

create unique index if not exists blog_views_unique_visitor
  on public.blog_views (blog_id, visitor_id)
  where visitor_id is not null;

create index if not exists blog_views_blog_id_idx
  on public.blog_views (blog_id);

-- Optional: simple counts view
create or replace view public.blog_view_counts as
select
  blog_id,
  count(*)::bigint as view_count
from public.blog_views
group by blog_id;

-- RLS: keep it enabled (we insert via Next.js API routes with service role)
alter table public.blog_views enable row level security;

-- Intentionally no policies (service role bypasses RLS).
