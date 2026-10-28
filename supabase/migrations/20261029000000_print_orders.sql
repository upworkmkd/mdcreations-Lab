-- MD Creations Labs: "Order it printed". A customer pays for a design printed, assembled and posted to them;
-- the shop downloads the files from the admin, prints, ships and moves the order along.
-- Paste into the Supabase SQL editor and press Run (after the earlier migrations). Safe to run again.


-- ---------------------------------------------------------------- the printed price of each tool (shipping included)
create table if not exists public.tool_print_prices (
  tool_slug     text not null references public.tools (slug) on delete cascade,
  currency      text not null check (currency in ('INR', 'USD')),
  amount_minor  int  not null check (amount_minor >= 0),
  updated_at    timestamptz not null default now(),
  primary key (tool_slug, currency)
);
alter table public.tool_print_prices enable row level security;
drop policy if exists "anyone reads print prices" on public.tool_print_prices;
create policy "anyone reads print prices" on public.tool_print_prices for select using (true);
drop policy if exists "admins edit print prices" on public.tool_print_prices;
create policy "admins edit print prices" on public.tool_print_prices for all using (public.is_admin()) with check (public.is_admin());
grant select on public.tool_print_prices to anon, authenticated;
grant select, insert, update, delete on public.tool_print_prices to service_role;


-- ---------------------------------------------------------------- printed orders live in the same orders table
alter table public.orders add column if not exists kind text not null default 'download';
do $$ begin
  alter table public.orders add constraint orders_kind_check check (kind in ('download', 'print'));
exception when duplicate_object then null; end $$;

-- where it goes: { name, phone, line1, line2, city, state, pin, country }
alter table public.orders add column if not exists ship_to jsonb;
-- the shop's progress: to_print → printing → shipped → delivered (or cancelled)
alter table public.orders add column if not exists print_status text;
do $$ begin
  alter table public.orders add constraint orders_print_status_check check (print_status in ('to_print', 'printing', 'shipped', 'delivered', 'cancelled'));
exception when duplicate_object then null; end $$;
alter table public.orders add column if not exists courier      text check (char_length(courier) <= 80);
alter table public.orders add column if not exists tracking_no  text check (char_length(tracking_no) <= 80);
alter table public.orders add column if not exists shop_note    text check (char_length(shop_note) <= 2000);   -- only the shop sees it
alter table public.orders add column if not exists print_file   text;                                        -- the files to print, in the private bucket
alter table public.orders add column if not exists printing_at  timestamptz;
alter table public.orders add column if not exists shipped_at   timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists shipped_emailed_at timestamptz;
create index if not exists orders_print_idx on public.orders (kind, print_status, created_at desc) where kind = 'print';

-- a customer's last shipping address, offered again next time
alter table public.profiles add column if not exists ship_to jsonb;


-- ---------------------------------------------------------------- the email log knows the new emails
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('order_customer', 'order_admin', 'test', 'print_customer', 'print_admin', 'print_shipped', 'print_delivered'));
