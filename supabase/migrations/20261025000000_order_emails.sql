-- MD Creations Labs: emails after an order (a receipt for the customer, a note for the shop) and feedback on an order.
-- Paste into the Supabase SQL editor and press Run (after the earlier migrations). Safe to run again.


-- ---------------------------------------------------------------- site settings, changed from Admin → Settings
create table if not exists public.site_settings (
  key         text primary key check (char_length(key) between 1 and 60),
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "admins read settings" on public.site_settings;
create policy "admins read settings" on public.site_settings for select using (public.is_admin());
revoke all on public.site_settings from anon, authenticated;
grant select, insert, update, delete on public.site_settings to service_role;

-- order emails: on for customers and the shop; the shop's addresses are filled in on the Settings page
insert into public.site_settings (key, value)
values ('emails', '{"customer": true, "admin": true, "notify": []}'::jsonb)
on conflict (key) do nothing;


-- ---------------------------------------------------------------- each order is emailed once
alter table public.orders add column if not exists customer_emailed_at timestamptz;
alter table public.orders add column if not exists admin_notified_at timestamptz;


-- ---------------------------------------------------------------- feedback from the link in the order email
alter table public.feedback add column if not exists order_id uuid references public.orders (id) on delete set null;
create unique index if not exists feedback_order_uidx on public.feedback (order_id) where order_id is not null;


-- ---------------------------------------------------------------- every email the site sends, to see what went out (or failed)
create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('order_customer', 'order_admin', 'test')),
  to_email    text not null check (char_length(to_email) <= 600),
  subject     text check (char_length(subject) <= 300),
  order_id    uuid references public.orders (id) on delete set null,
  status      text not null check (status in ('sent', 'failed', 'skipped')),
  error       text check (char_length(error) <= 500),
  provider_id text,
  created_at  timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_order_idx on public.email_log (order_id);
alter table public.email_log enable row level security;
drop policy if exists "admins read email log" on public.email_log;
create policy "admins read email log" on public.email_log for select using (public.is_admin());
revoke all on public.email_log from anon, authenticated;
grant select, insert, update, delete on public.email_log to service_role;
