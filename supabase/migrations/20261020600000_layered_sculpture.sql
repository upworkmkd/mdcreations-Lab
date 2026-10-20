-- MD Creations Labs: prices for the Layered Sculpture Maker (same as a shadow lamp design: ₹199 / $3).
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- The tool stays "Coming soon" for visitors; as admin you can try it at /tools/layered-sculpture/make.
-- When you are happy, set it to Live in Admin → Tools and prices.

insert into public.tool_prices (tool_slug, currency, amount_minor) values
  ('layered-sculpture', 'INR', 19900),
  ('layered-sculpture', 'USD', 300)
on conflict (tool_slug, currency) do nothing;
