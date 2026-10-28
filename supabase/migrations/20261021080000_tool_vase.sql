-- MD Creations Labs: the Vase & Lamp Shade Maker (₹199 / $3 a design).
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- The tool stays "Coming soon" for visitors; as admin you can try it at /tools/vase/make.
-- When you are happy, set it to Live in Admin → Tools and prices.

insert into public.tools (slug, name, status, sort) values
  ('vase', 'Vase & Lamp Shade Maker', 'coming_soon', 11)
on conflict (slug) do nothing;

insert into public.tool_prices (tool_slug, currency, amount_minor) values
  ('vase', 'INR', 19900),
  ('vase', 'USD', 300)
on conflict (tool_slug, currency) do nothing;
