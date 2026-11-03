-- MD Creations Labs: the Lithophane Maker (₹199 / $3 a design, like the other makers).
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- The tool stays "Coming soon" for visitors; as admin you can try it at /tools/lithophane/make.
-- When you are happy, set it to Live in Admin → Tools and prices.

insert into public.tools (slug, name, status, sort) values
  ('lithophane', 'Lithophane Maker', 'coming_soon', 5)
on conflict (slug) do nothing;

insert into public.tool_prices (tool_slug, currency, amount_minor) values
  ('lithophane', 'INR', 19900),
  ('lithophane', 'USD', 300)
on conflict (tool_slug, currency) do nothing;
