-- Adds per-product skyboxes configurable by weather.
-- Stores public URLs (typically equirectangular JPG/PNG) keyed by weather.
-- Example JSON:
-- {"sunny":"https://.../skyboxes/sunny.jpg","rainy":"https://.../skyboxes/rainy.jpg","night":null,"foggy":null}

alter table if exists public.products
  add column if not exists skyboxes jsonb;
