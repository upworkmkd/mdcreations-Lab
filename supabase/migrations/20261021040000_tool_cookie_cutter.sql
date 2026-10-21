-- MD Creations Labs: the Cookie Cutter & Stamp Maker (₹199 / $3 a design).
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- The tool stays "Coming soon" for visitors; as admin you can try it at /tools/cookie-cutter/make.
-- When you are happy, set it to Live in Admin → Tools and prices.

insert into public.tools (slug, name, status, sort) values
  ('cookie-cutter', 'Cookie Cutter & Stamp Maker', 'coming_soon', 7)
on conflict (slug) do nothing;

insert into public.tool_prices (tool_slug, currency, amount_minor) values
  ('cookie-cutter', 'INR', 19900),
  ('cookie-cutter', 'USD', 300)
on conflict (tool_slug, currency) do nothing;
