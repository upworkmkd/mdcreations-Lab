-- MD Creations Labs: the Topographic Map Maker (₹199 / $3 a design).
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- The tool stays "Coming soon" for visitors; as admin you can try it at /tools/topo-map/make.
-- When you are happy, set it to Live in Admin → Tools and prices.

insert into public.tools (slug, name, status, sort) values
  ('topo-map', 'Topographic Map Maker', 'coming_soon', 10)
on conflict (slug) do nothing;

insert into public.tool_prices (tool_slug, currency, amount_minor) values
  ('topo-map', 'INR', 19900),
  ('topo-map', 'USD', 300)
on conflict (tool_slug, currency) do nothing;
