-- Services page content + service custom icon/logo support
-- Run in Supabase SQL editor.

-- 1) Add optional custom icon/logo URL to existing services table
alter table public.services
  add column if not exists icon_url text;

-- 2) Services page (hero/intro text) content table
create table if not exists public.services_page_content (
  slug text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Ensure the default row exists
insert into public.services_page_content (slug, content)
values (
  'services',
  jsonb_build_object(
    'heroImageUrl', '/sevices.avif',
    'heroTitle', 'Our Services',
    'introText', 'Explore our full range of services, expertly designed to meet both residential and commercial needs. From precision-crafted aluminum windows and doors to custom glass installations, our expertise spans design, fabrication, and installation. Discover how we can transform your space with top-tier craftsmanship and innovative solutions built for style, durability, and performance.',
    'sectionText', 'Explore our full range of services, expertly designed to meet both residential and commercial needs.'
  )
)
on conflict (slug) do nothing;

-- 3) If RLS is enabled, you may need policies like:
-- (Adjust as needed for your security model)
--
-- alter table public.services enable row level security;
-- create policy "Public read services" on public.services for select using (true);
--
-- alter table public.services_page_content enable row level security;
-- create policy "Public read services page" on public.services_page_content for select using (true);
--
-- NOTE: Writes should be done via server routes using SUPABASE_SERVICE_ROLE_KEY.
