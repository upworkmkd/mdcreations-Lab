-- MD Creations Labs: cookieless page counts for visitors who have not accepted analytics cookies.
-- Nothing here identifies a person: no IP, no city, no browser string, no id that survives the open tab.
-- Paste into the Supabase SQL editor and press Run. Safe to run again.

create table if not exists public.anon_views (
  id          bigint generated always as identity primary key,
  visit       text not null,           -- random, lives only in the open tab's memory; a reload starts a new one
  type        text not null default 'pageview' check (type in ('pageview', 'leave')),
  path        text not null,
  title       text,
  referrer    text,                     -- the referring site's domain only, on the first page of a visit
  utm_source  text,
  country     text,                     -- two letters, from Vercel
  device_type text,                     -- desktop, mobile, tablet
  browser     text,                     -- name only, e.g. Chrome
  os          text,                     -- name only, e.g. Android
  seconds     int,                      -- on 'leave': time on the page
  scroll      int,                      -- on 'leave': how far down, %
  created_at  timestamptz not null default now()
);
create index if not exists anon_views_created_idx on public.anon_views (created_at desc);
create index if not exists anon_views_visit_idx on public.anon_views (visit, created_at);

alter table public.anon_views enable row level security;
drop policy if exists "admins read anon views" on public.anon_views;
create policy "admins read anon views" on public.anon_views for select using (public.is_admin());

-- numbers for the admin overview (times in India)
create or replace function public.admin_anon_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t0 timestamptz := ((now() at time zone 'Asia/Kolkata')::date - (p_days - 1)) at time zone 'Asia/Kolkata';
  today timestamptz := ((now() at time zone 'Asia/Kolkata')::date) at time zone 'Asia/Kolkata';
  r jsonb;
begin
  with v as (select * from anon_views where created_at >= t0),
  pv as (select * from v where type = 'pageview'),
  firsts as (select distinct on (visit) visit, referrer, utm_source, country, device_type, browser, os from pv order by visit, created_at),
  days as (select generate_series((now() at time zone 'Asia/Kolkata')::date - (p_days - 1), (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as d),
  per_day as (select (created_at at time zone 'Asia/Kolkata')::date as d, count(distinct visit) as visits, count(*) as views from pv group by 1)
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'views', (select count(*) from pv),
      'visits', (select count(distinct visit) from pv),
      'today_visits', (select count(distinct visit) from pv where created_at >= today),
      'avg_seconds', (select coalesce(round(avg(seconds)), 0) from v where type = 'leave' and seconds between 1 and 3600)
    ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', days.d, 'visitors', coalesce(per_day.visits, 0), 'pageviews', coalesce(per_day.views, 0)) order by days.d), '[]'::jsonb)
              from days left join per_day on per_day.d = days.d),
    'pages', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select path as k, count(*) as n, count(distinct visit) as u from pv group by 1 order by n desc limit 12) t),
    'referrers', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select coalesce(referrer, 'Direct') as k, count(*) as n from firsts group by 1 order by n desc limit 10) t),
    'countries', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select coalesce(country, '??') as k, count(*) as n from firsts group by 1 order by n desc limit 10) t),
    'devices', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select coalesce(device_type, 'desktop') as k, count(*) as n from firsts group by 1 order by n desc) t),
    'browsers', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select coalesce(browser, 'Unknown') as k, count(*) as n from firsts group by 1 order by n desc limit 8) t)
  ) into r;
  return r;
end $$;

revoke all on function public.admin_anon_stats(int) from public, anon, authenticated;
grant execute on function public.admin_anon_stats(int) to service_role;
