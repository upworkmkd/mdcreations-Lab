-- MD Creations Labs: the Design Studio (draw signs, keychains, coasters and pixel art in colours).
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- It starts as "Coming soon": try it as admin, set its prices in Admin → Tools and prices, then switch it to Live.

insert into public.tools (slug, name, status, sort) values
  ('design-studio', 'Design Studio', 'coming_soon', 16)
on conflict (slug) do nothing;
