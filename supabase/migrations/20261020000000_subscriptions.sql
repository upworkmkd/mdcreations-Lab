-- MD Creations Labs: monthly plans (Razorpay Subscriptions).
-- Paste the whole file into the Supabase SQL editor and press Run (after the earlier migrations).
-- Safe to run again: it only adds what is missing and never deletes data.


-- ---------------------------------------------------------------- plans
create table if not exists public.plans (
  id           text primary key,                    -- 'starter', 'standard'
  name         text not null,
  tools        int,                                  -- how many tools the subscriber picks; null = every tool
  daily_limit  int,                                  -- designs per day (India time); null = no limit
  status       text not null default 'live' check (status in ('live', 'contact', 'hidden')),   -- contact = "Contact us" instead of Subscribe
  sort         int not null default 0,
  updated_at   timestamptz not null default now()
);

create table if not exists public.plan_prices (
  plan_id           text not null references public.plans (id) on delete cascade,
  currency          text not null check (currency in ('INR', 'USD')),
  amount_minor      int  not null check (amount_minor > 0),   -- per month, paise / cents
  razorpay_plan_id  text,                                       -- made by the admin page; Razorpay plans cannot change price
  updated_at        timestamptz not null default now(),
  primary key (plan_id, currency)
);

-- ---------------------------------------------------------------- subscriptions
create table if not exists public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id) on delete cascade,
  plan_id                   text not null references public.plans (id),
  tool_slug                 text references public.tools (slug),        -- the tool chosen on Starter
  currency                  text not null check (currency in ('INR', 'USD')),
  amount_minor              int  not null,
  status                    text not null default 'created'
                            check (status in ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired', 'paused')),
  provider                  text not null default 'razorpay',
  provider_subscription_id  text unique,
  provider_plan_id          text,
  current_start             timestamptz,
  current_end               timestamptz,            -- paid up to here
  paid_count                int not null default 0,
  cancel_at_period_end      boolean not null default false,
  cancelled_at              timestamptz,
  short_url                 text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

-- designs built with a plan are orders of 0 with this set
alter table public.orders add column if not exists subscription_id uuid references public.subscriptions (id) on delete set null;
create index if not exists orders_subscription_idx on public.orders (subscription_id, created_at desc);

-- payments for renewals have no order of ours; they point at the subscription instead
alter table public.payments alter column order_id drop not null;
alter table public.payments add column if not exists subscription_id uuid references public.subscriptions (id) on delete set null;

alter table public.plans         enable row level security;
alter table public.plan_prices   enable row level security;
alter table public.subscriptions enable row level security;
drop policy if exists "plans are public" on public.plans;
create policy "plans are public" on public.plans for select using (true);
drop policy if exists "plan prices are public" on public.plan_prices;
create policy "plan prices are public" on public.plan_prices for select using (true);
drop policy if exists "admins edit plans" on public.plans;
create policy "admins edit plans" on public.plans for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins edit plan prices" on public.plan_prices;
create policy "admins edit plan prices" on public.plan_prices for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "read own subscriptions" on public.subscriptions;
create policy "read own subscriptions" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
-- subscriptions are written by the server only

-- ---------------------------------------------------------------- seed
insert into public.plans (id, name, tools, daily_limit, status, sort) values
  ('starter',  'Starter',  1,    10,   'live',    1),
  ('standard', 'Standard', null, null, 'contact', 2)
on conflict (id) do nothing;

insert into public.plan_prices (plan_id, currency, amount_minor) values
  ('starter',  'INR', 199900), ('starter',  'USD', 2000),
  ('standard', 'INR', 399900), ('standard', 'USD', 4000)
on conflict do nothing;
