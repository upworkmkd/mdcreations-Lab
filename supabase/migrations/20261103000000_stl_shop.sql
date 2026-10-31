-- MD Creations Labs: the STL shop. Ready-made designs sold as STL files (commercial license), or printed and posted.
-- Paste into the Supabase SQL editor and press Run (after the earlier migrations). Safe to run again.
--
-- What stays private: the STL files and the download zip live in the private lab-files bucket under products/<id>/.
-- Nobody can read them directly; the server hands a buyer a short signed link only after the order is paid.
-- What is public: the preview pictures (stl-images bucket) and the product text, for live products only.


-- ---------------------------------------------------------------- products
create table if not exists public.stl_products (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title           text not null check (char_length(title) between 2 and 120),
  subtitle        text not null default '' check (char_length(subtitle) <= 200),     -- one line under the title, and on the card
  description     text not null default '' check (char_length(description) <= 8000),  -- paragraphs separated by blank lines
  assembly        text not null default '' check (char_length(assembly) <= 8000),     -- one step per line
  hardware        jsonb not null default '[]'::jsonb,                                  -- [{ item, qty, note }]
  print_notes     text not null default '' check (char_length(print_notes) <= 4000),  -- one tip per line
  specs           jsonb not null default '[]'::jsonb,                                  -- [[label, value], ...]: size, parts, scale…
  images          jsonb not null default '[]'::jsonb,                                  -- [{ path, alt }] in stl-images; the first is the feature image
  files           jsonb not null default '[]'::jsonb,                                  -- [{ name, path, bytes }] the STL parts, private
  package_path    text,                                                                -- the download zip, private (lab-files)
  package_bytes   bigint,
  package_built_at timestamptz,
  price_inr       int check (price_inr is null or price_inr >= 0),                    -- download, in paise; null = not sold in ₹
  price_usd       int check (price_usd is null or price_usd >= 0),                    -- download, in cents; null = not sold in $
  print_price_inr int check (print_price_inr is null or print_price_inr >= 100),      -- printed and posted (India), shipping included
  status          text not null default 'draft' check (status in ('draft', 'live', 'hidden')),
  sort            int not null default 100,
  seo_title       text not null default '' check (char_length(seo_title) <= 120),
  seo_description text not null default '' check (char_length(seo_description) <= 300),
  keywords        text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists stl_products_live_idx on public.stl_products (status, sort, created_at desc);

alter table public.stl_products enable row level security;
drop policy if exists "anyone reads live stl products" on public.stl_products;
create policy "anyone reads live stl products" on public.stl_products for select using (status = 'live' or public.is_admin());
drop policy if exists "admins edit stl products" on public.stl_products;
create policy "admins edit stl products" on public.stl_products for all using (public.is_admin()) with check (public.is_admin());
-- the browser never needs the private paths: only these columns are readable with the public keys
revoke all on public.stl_products from anon, authenticated;
grant select (id, slug, title, subtitle, description, assembly, hardware, print_notes, specs, images, price_inr, price_usd, print_price_inr, status, sort,
              seo_title, seo_description, keywords, created_at, updated_at) on public.stl_products to anon, authenticated;
grant all on public.stl_products to service_role;


-- ---------------------------------------------------------------- orders and files can be for a product instead of a design
-- tool_slug stays filled ('stl'), so every list that groups by tool keeps working
insert into public.tools (slug, name, status, sort) values ('stl', 'STL files', 'hidden', 900) on conflict (slug) do nothing;

alter table public.orders alter column design_id drop not null;
alter table public.orders add column if not exists product_id uuid references public.stl_products (id) on delete restrict;
do $$ begin
  alter table public.orders add constraint orders_design_or_product check (design_id is not null or product_id is not null);
exception when duplicate_object then null; end $$;
create index if not exists orders_product_idx on public.orders (product_id) where product_id is not null;

alter table public.files add column if not exists product_id uuid references public.stl_products (id) on delete set null;


-- ---------------------------------------------------------------- pictures: public, small, images only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stl-images', 'stl-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;


-- ---------------------------------------------------------------- the first product: the Willys jeep (a draft: add pictures, files and a price, then set it live)
insert into public.stl_products (slug, title, subtitle, description, assembly, hardware, print_notes, specs, status, sort, seo_title, seo_description, keywords)
values (
  'willys-jeep-scale-model',
  'Willys Jeep Scale Model',
  'A classic WWII Willys jeep to print and build: 29 parts, rolling wheels, about 22 cm long.',
  'A desk-size Willys jeep, the classic WWII and Indian Army four-wheeler, designed for FDM printers and built from 29 printed parts.

The body comes in two halves with a separate grille and windscreen frame, so each piece prints flat and clean. It sits on a printed ladder chassis with front and rear axles, and the wheels are built from a hub, a rim plate, an outer rim and a detailed tyre with a real tread pattern, so they roll.

It is a static (non-RC) model, made to look good on a shelf and to be a satisfying weekend build. Print it in olive drab for the army look, or pick your own colours.',
  'Print all the parts (see the print notes).
Fit the front axle tube and axle rings onto the front axle.
Fix the front and rear axles to the chassis with the axle clamps.
Build each wheel: hub, rim plate and outer rim, then press the rim into the tyre.
Slide the wheels onto the axle ends.
Fit the front and rear body halves onto the chassis.
Add the front grille and the windscreen frame.',
  '[{"item": "Small self-tapping screws, about M2 x 8 mm", "qty": "", "note": "For the chassis and axle clamps (holes are 1.5-2 mm)"}, {"item": "Superglue (CA)", "qty": "", "note": "For the body halves, grille and windscreen frame"}]'::jsonb,
  'PLA or PETG, 0.16-0.2 mm layers, 15-20% infill.
Tyres: TPU 95A gives real rubber tyres; black PLA works too.
Body halves: print upright as exported; use tree supports where the slicer asks.
Small parts (clamps, rings, hubs): 0.12-0.16 mm layers for clean holes.',
  '[["Length", "About 223 mm"], ["Width", "About 112 mm"], ["Height", "About 115 mm"], ["Parts", "29 STL files"], ["Type", "Static scale model (non-RC)"], ["Printer", "Any FDM printer, 180 x 180 mm bed or larger"]]'::jsonb,
  'draft', 10,
  'Willys Jeep 3D Print STL Files – Scale Model Kit (29 Parts)',
  'STL files for a 22 cm Willys jeep scale model: 29 printable parts, detailed tyres and rolling wheels. Commercial license included, or order it printed.',
  array['willys jeep stl', 'jeep 3d print', 'willys jeep 3d model', 'army jeep stl', 'scale model stl', '3d printable car model']
)
on conflict (slug) do nothing;
