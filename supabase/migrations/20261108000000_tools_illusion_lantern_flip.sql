-- MD Creations Labs: three new tools.
--   Two-Name Illusion   ₹149 / $3 a design
--   360° Shadow Lantern ₹249 / $4 a design
--   Flip Picture        ₹149 / $3 a design
-- Paste into the Supabase SQL editor and press Run. Safe to run again (it never changes prices you have set since).
-- They start as "Coming soon": try them as admin, adjust prices in Admin → Tools and prices, then switch them to Live.

insert into public.tools (slug, name, status, sort) values
  ('name-illusion',  'Two-Name Illusion',   'coming_soon', 17),
  ('shadow-lantern', '360° Shadow Lantern', 'coming_soon', 18),
  ('flip-picture',   'Flip Picture',        'coming_soon', 19)
on conflict (slug) do nothing;

insert into public.tool_prices (tool_slug, currency, amount_minor) values
  ('name-illusion',  'INR', 14900), ('name-illusion',  'USD', 300),
  ('shadow-lantern', 'INR', 24900), ('shadow-lantern', 'USD', 400),
  ('flip-picture',   'INR', 14900), ('flip-picture',   'USD', 300)
on conflict (tool_slug, currency) do nothing;
