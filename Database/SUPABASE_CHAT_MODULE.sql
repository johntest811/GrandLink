-- GrandLink Chat Module (Supabase)
-- Bucket name (Supabase Storage): chat-uploads
-- Recommended: create bucket as Public (for simple image sharing) OR Private + signed URLs.

-- 1) Tables
-- Requires pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),

  -- Status flow: pending -> active -> resolved
  status text not null default 'pending' check (status in ('pending', 'active', 'resolved')),

  -- Visitor info (used when not logged in)
  visitor_name text,
  visitor_email text,

  -- Logged-in user (optional)
  user_id uuid,

  -- Guest access token stored in browser localStorage
  access_token uuid not null unique default gen_random_uuid(),

  -- Admin workflow timestamps
  accepted_at timestamptz,
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists chat_threads_status_last_message_idx
  on public.chat_threads (status, last_message_at desc);

create index if not exists chat_threads_access_token_idx
  on public.chat_threads (access_token);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  thread_id uuid not null references public.chat_threads(id) on delete cascade,

  -- sender_type: visitor/user/admin
  sender_type text not null check (sender_type in ('visitor', 'user', 'admin')),
  sender_name text,
  sender_email text,

  body text,
  image_url text,

  -- Simple read flags (optional)
  read_by_admin boolean not null default false,
  read_by_user boolean not null default false
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at asc);

-- 2) RLS
-- We recommend corrected security posture:
-- - Keep RLS enabled (blocks direct anon access)
-- - Access is via Next.js API routes using service role key
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

-- Intentionally NO policies here because the apps use server-side API routes with service-role.
-- (Service role bypasses RLS.)

-- 3) Storage
-- Create a storage bucket named: chat-uploads
-- In Supabase Dashboard:
-- Storage -> New bucket -> Name: chat-uploads
-- For simplest setup: Public = ON
-- If you choose Private, you must implement signed URLs for viewing/downloading.

-- 4) Admin RBAC (optional but recommended)
-- This makes the Chat Inbox page available in the Roles & Permissions UI
-- and allows it to appear in the sidebar for non-superadmins.
--
-- Tables used by the admin panel:
--   public.rbac_pages(key,name,path,group_name)
--   public.rbac_position_pages(position_name,page_key)
--
-- Add the page definition
insert into public.rbac_pages (key, name, path, group_name)
values ('dashboard_chat', 'Chat Inbox', '/dashboard/chat', 'Dashboard')
on conflict (path) do update set
  name = excluded.name,
  group_name = excluded.group_name;

-- Grant it to all existing positions by default (you can remove via the Roles UI)
insert into public.rbac_position_pages (position_name, page_key)
select p.name, 'dashboard_chat'
from public.rbac_positions p
on conflict do nothing;
