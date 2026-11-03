-- MD Creations Labs: the free Image to STL converter.
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- It is free, so it has no prices. It goes live straight away; hide it in Admin → Tools and prices if needed.

insert into public.tools (slug, name, status, sort, free) values
  ('image-to-stl', 'Image to STL Converter', 'live', 15, true)
on conflict (slug) do update set free = true;
