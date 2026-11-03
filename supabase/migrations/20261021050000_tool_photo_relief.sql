-- MD Creations Labs: the Photo Relief Maker (₹199 / $3 a design).
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- The tool stays "Coming soon" for visitors; as admin you can try it at /tools/photo-relief/make.
-- When you are happy, set it to Live in Admin → Tools and prices.

insert into public.tools (slug, name, status, sort) values
  ('photo-relief', 'Photo Relief Maker', 'coming_soon', 8)
on conflict (slug) do nothing;

insert into public.tool_prices (tool_slug, currency, amount_minor) values
  ('photo-relief', 'INR', 19900),
  ('photo-relief', 'USD', 300)
on conflict (tool_slug, currency) do nothing;
