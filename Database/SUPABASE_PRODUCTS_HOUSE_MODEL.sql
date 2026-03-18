-- Add house model URL support for product-level 3D house context
-- Run in Supabase SQL editor.

alter table if exists public.products
  add column if not exists house_model_url text;

comment on column public.products.house_model_url is
  'Optional URL for a separate 3D house/context model (FBX/GLB/GLTF) used by product viewers.';
