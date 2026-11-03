-- MD Creations Labs: the Filament Painting Maker (₹199 / $3 a design).
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- The tool stays "Coming soon" for visitors; as admin you can try it at /tools/filament-painting/make.
-- When you are happy, set it to Live in Admin → Tools and prices.

insert into public.tools (slug, name, status, sort) values
  ('filament-painting', 'Filament Painting Maker', 'coming_soon', 9)
on conflict (slug) do nothing;

insert into public.tool_prices (tool_slug, currency, amount_minor) values
  ('filament-painting', 'INR', 19900),
  ('filament-painting', 'USD', 300)
on conflict (tool_slug, currency) do nothing;
