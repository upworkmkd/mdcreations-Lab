-- MD Creations Labs: the free Print Cost Calculator.
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- It is free, so it has no prices. It goes live straight away; hide it in Admin → Tools and prices if needed.

insert into public.tools (slug, name, status, sort) values
  ('print-cost', 'Print Cost Calculator', 'live', 13)
on conflict (slug) do nothing;
