-- MD Creations Labs: schema, row level security and storage.
-- Paste the whole file into the Supabase SQL editor and press Run.
-- Safe to run again: it only adds what is missing and never deletes data.


-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
-- (if a profiles table already existed, these add the columns the site needs)
alter table public.profiles add column if not exists email      text;
alter table public.profiles add column if not exists full_name  text;
alter table public.profiles add column if not exists role       text not null default 'user';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- people who signed up before this script ran get their profile now
insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
on conflict (id) do update set email = excluded.email;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------- catalogue
create table if not exists public.tools (
  slug        text primary key,
  name        text not null,
  status      text not null default 'coming_soon' check (status in ('live', 'coming_soon', 'hidden')),
  sort        int  not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.tool_prices (
  tool_slug     text not null references public.tools (slug) on delete cascade,
  currency      text not null check (currency in ('INR', 'USD')),
  amount_minor  int  not null check (amount_minor >= 0),   -- paise / cents
  updated_at    timestamptz not null default now(),
  primary key (tool_slug, currency)
);

-- ---------------------------------------------------------------- designs, orders, files
create table if not exists public.designs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  tool_slug   text not null references public.tools (slug),
  name        text not null default 'Design',
  params      jsonb not null,           -- everything needed to rebuild the files on the server
  preview     text,                     -- small jpeg data url of the shadow, for the account pages
  created_at  timestamptz not null default now()
);
create index if not exists designs_user_idx on public.designs (user_id, created_at desc);

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  design_id          uuid not null references public.designs (id) on delete restrict,
  tool_slug          text not null references public.tools (slug),
  currency           text not null check (currency in ('INR', 'USD')),
  amount_minor       int  not null check (amount_minor >= 0),
  status             text not null default 'created' check (status in ('created', 'paid', 'fulfilled', 'failed', 'refunded')),
  provider           text not null default 'razorpay',
  provider_order_id  text unique,
  error              text,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz,
  fulfilled_at       timestamptz
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

create table if not exists public.payments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete cascade,
  user_id              uuid not null references auth.users (id) on delete cascade,
  provider             text not null default 'razorpay',
  provider_payment_id  text not null unique,
  amount_minor         int  not null,
  currency             text not null,
  status               text not null,
  method               text,
  created_at           timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

create table if not exists public.files (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  order_id      uuid not null unique references public.orders (id) on delete cascade,
  design_id     uuid references public.designs (id) on delete set null,
  tool_slug     text not null references public.tools (slug),
  name          text not null,
  storage_path  text not null,
  size_bytes    bigint not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists files_user_idx on public.files (user_id, created_at desc);

create table if not exists public.downloads (
  id          bigint generated always as identity primary key,
  file_id     uuid not null references public.files (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists downloads_file_idx on public.downloads (file_id);

-- ---------------------------------------------------------------- row level security
alter table public.profiles    enable row level security;
alter table public.tools       enable row level security;
alter table public.tool_prices enable row level security;
alter table public.designs     enable row level security;
alter table public.orders      enable row level security;
alter table public.payments    enable row level security;
alter table public.files       enable row level security;
alter table public.downloads   enable row level security;

-- everyone may read the catalogue; only admins change it
drop policy if exists "tools are public" on public.tools;
create policy "tools are public" on public.tools       for select using (true);
drop policy if exists "prices are public" on public.tool_prices;
create policy "prices are public" on public.tool_prices for select using (true);
drop policy if exists "admins edit tools" on public.tools;
create policy "admins edit tools" on public.tools       for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins edit prices" on public.tool_prices;
create policy "admins edit prices" on public.tool_prices for all using (public.is_admin()) with check (public.is_admin());

-- profiles: read and rename your own; the role column can only be changed with the service key
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant  update (full_name) on public.profiles to authenticated;

-- designs belong to their maker
drop policy if exists "read own designs" on public.designs;
create policy "read own designs" on public.designs for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "add own designs" on public.designs;
create policy "add own designs" on public.designs for insert with check (user_id = auth.uid());
drop policy if exists "delete own designs" on public.designs;
create policy "delete own designs" on public.designs for delete using (user_id = auth.uid());

-- orders, payments, files and downloads are written by the server (service key) only
drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders    for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "read own payments" on public.payments;
create policy "read own payments" on public.payments  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "read own files" on public.files;
create policy "read own files" on public.files     for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "read own downloads" on public.downloads;
create policy "read own downloads" on public.downloads for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- storage: private bucket for paid files
insert into storage.buckets (id, name, public, file_size_limit)
values ('lab-files', 'lab-files', false, 52428800)
on conflict (id) do nothing;
-- No storage policies on purpose: files are only ever handed out through short signed links made by the server.

-- ---------------------------------------------------------------- seed
insert into public.tools (slug, name, status, sort) values
  ('shadow-lamp',     'Shadow Lamp Maker',       'live',        1),
  ('statue',          'Statue Maker',            'coming_soon', 2),
  ('layered-sculpture','Layered Sculpture Maker','coming_soon', 3),
  ('stl-repair',      'STL Repair',              'coming_soon', 4)
on conflict (slug) do nothing;

insert into public.tool_prices (tool_slug, currency, amount_minor) values
  ('shadow-lamp', 'INR', 19900),
  ('shadow-lamp', 'USD', 300)
on conflict do nothing;

-- After you sign up on the site, make yourself the admin (see supabase/make_admin.sql):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
