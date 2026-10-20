-- MD Creations Labs: visitor tracking, activity timeline and customer reviews.
-- Paste the whole file into the Supabase SQL editor and press Run (after the first migration).
-- Safe to run again: it only adds what is missing and never deletes data.


-- ---------------------------------------------------------------- visitors (one row per browser)
create table if not exists public.visitors (
  id              uuid primary key,                 -- the mdl_vid cookie
  user_id         uuid references auth.users (id) on delete set null,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  visits          int  not null default 0,          -- sessions
  pageviews       int  not null default 0,
  events          int  not null default 0,
  -- network and place (from the request; place comes from Vercel's IP lookup)
  ip              text,
  country         text,
  region          text,
  city            text,
  latitude        double precision,
  longitude       double precision,
  -- browser and device
  user_agent      text,
  browser         text,
  browser_version text,
  os              text,
  os_version      text,
  device_type     text,                             -- desktop, mobile, tablet
  device_vendor   text,
  device_model    text,
  language        text,
  languages       text,
  timezone        text,
  screen          text,                             -- 1920x1080
  viewport        text,
  pixel_ratio     real,
  color_scheme    text,
  touch           boolean,
  cpu_cores       int,
  memory_gb       real,
  connection      text,
  -- how they first arrived
  first_referrer  text,
  first_landing   text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_term        text,
  utm_content     text,
  last_path       text,
  consent         text
);
create index if not exists visitors_last_seen_idx on public.visitors (last_seen desc);
create index if not exists visitors_user_idx on public.visitors (user_id);
create index if not exists visitors_first_seen_idx on public.visitors (first_seen desc);

-- ---------------------------------------------------------------- sessions (a visit; ends after 30 idle minutes)
create table if not exists public.visitor_sessions (
  id           uuid primary key,                    -- the mdl_sid cookie
  visitor_id   uuid not null references public.visitors (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  started_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  pageviews    int not null default 0,
  events       int not null default 0,
  ip           text,
  country      text,
  city         text,
  browser      text,
  os           text,
  device_type  text,
  referrer     text,
  landing      text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text
);
create index if not exists visitor_sessions_visitor_idx on public.visitor_sessions (visitor_id, started_at desc);
create index if not exists visitor_sessions_started_idx on public.visitor_sessions (started_at desc);

-- ---------------------------------------------------------------- events (everything they do)
create table if not exists public.visitor_events (
  id          bigint generated always as identity primary key,
  visitor_id  uuid not null references public.visitors (id) on delete cascade,
  session_id  uuid references public.visitor_sessions (id) on delete set null,
  user_id     uuid references auth.users (id) on delete set null,
  type        text not null,          -- pageview, leave, click, input, submit, file, error, signup, signin, design_saved, checkout, payment, download …
  name        text,
  path        text,
  title       text,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists visitor_events_visitor_idx on public.visitor_events (visitor_id, created_at desc);
create index if not exists visitor_events_user_idx on public.visitor_events (user_id, created_at desc);
create index if not exists visitor_events_created_idx on public.visitor_events (created_at desc);
create index if not exists visitor_events_type_idx on public.visitor_events (type, created_at desc);

alter table public.visitors         enable row level security;
alter table public.visitor_sessions enable row level security;
alter table public.visitor_events   enable row level security;
-- Only admins can read; all writes go through the server with the service key.
drop policy if exists "admins read visitors" on public.visitors;
create policy "admins read visitors" on public.visitors for select using (public.is_admin());
drop policy if exists "admins read sessions" on public.visitor_sessions;
create policy "admins read sessions" on public.visitor_sessions for select using (public.is_admin());
drop policy if exists "admins read events" on public.visitor_events;
create policy "admins read events" on public.visitor_events for select using (public.is_admin());


-- ---------------------------------------------------------------- accounts that are never tracked (the shop owner, testers)
alter table public.profiles add column if not exists track boolean not null default true;
update public.profiles set track = false where role = 'admin';

create or replace function public.untracked(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_uid is not null and exists (select 1 from profiles where id = p_uid and track = false);
$$;

-- removes everything recorded for an account (all its browsers, visits and events)
create or replace function public.forget_tracking(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from visitors where user_id = p_uid;
  delete from visitor_events where user_id = p_uid;
  delete from visitor_sessions where user_id = p_uid;
end $$;


-- ---------------------------------------------------------------- ingest: one call per batch from /api/track
create or replace function public.track_ingest(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_vid uuid := (p->>'vid')::uuid;
  v_sid uuid := (p->>'sid')::uuid;
  v_uid uuid := nullif(p->>'uid', '')::uuid;
  v_old uuid;
  v_ev  jsonb := coalesce(p->'events', '[]'::jsonb);
  n_ev  int;
  n_pv  int;
  v_new boolean;
  v_last text;
  c jsonb := coalesce(p->'ctx', '{}'::jsonb);
  s jsonb := coalesce(p->'session', '{}'::jsonb);
begin
  if public.untracked(v_uid) then delete from visitors where id = v_vid; return; end if;
  n_ev := jsonb_array_length(v_ev);
  select count(*) into n_pv from jsonb_array_elements(v_ev) e where e->>'type' = 'pageview';
  select e->>'path' into v_last from jsonb_array_elements(v_ev) e where e->>'type' = 'pageview' order by (e->>'ts') desc nulls last limit 1;
  select user_id into v_old from visitors where id = v_vid;

  insert into visitors as v (
    id, user_id, ip, country, region, city, latitude, longitude,
    user_agent, browser, browser_version, os, os_version, device_type, device_vendor, device_model,
    language, languages, timezone, screen, viewport, pixel_ratio, color_scheme, touch, cpu_cores, memory_gb, connection,
    first_referrer, first_landing, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    pageviews, events, last_path, consent)
  values (
    v_vid, v_uid, p->>'ip', p->>'country', p->>'region', p->>'city', (p->>'lat')::double precision, (p->>'lon')::double precision,
    p->>'ua', p->>'browser', p->>'browser_version', p->>'os', p->>'os_version', p->>'device_type', p->>'device_vendor', p->>'device_model',
    c->>'lang', c->>'langs', c->>'tz', c->>'screen', c->>'viewport', (c->>'dpr')::real, c->>'scheme', (c->>'touch')::boolean,
    (c->>'cores')::int, (c->>'memory')::real, c->>'net',
    s->>'referrer', s->>'landing', s->>'utm_source', s->>'utm_medium', s->>'utm_campaign', s->>'utm_term', s->>'utm_content',
    n_pv, n_ev, v_last, p->>'consent')
  on conflict (id) do update set
    last_seen      = now(),
    user_id        = coalesce(excluded.user_id, v.user_id),
    pageviews      = v.pageviews + n_pv,
    events         = v.events + n_ev,
    ip             = coalesce(excluded.ip, v.ip),
    country        = coalesce(excluded.country, v.country),
    region         = coalesce(excluded.region, v.region),
    city           = coalesce(excluded.city, v.city),
    latitude       = coalesce(excluded.latitude, v.latitude),
    longitude      = coalesce(excluded.longitude, v.longitude),
    user_agent     = coalesce(excluded.user_agent, v.user_agent),
    browser        = coalesce(excluded.browser, v.browser),
    browser_version= coalesce(excluded.browser_version, v.browser_version),
    os             = coalesce(excluded.os, v.os),
    os_version     = coalesce(excluded.os_version, v.os_version),
    device_type    = coalesce(excluded.device_type, v.device_type),
    device_vendor  = coalesce(excluded.device_vendor, v.device_vendor),
    device_model   = coalesce(excluded.device_model, v.device_model),
    language       = coalesce(excluded.language, v.language),
    languages      = coalesce(excluded.languages, v.languages),
    timezone       = coalesce(excluded.timezone, v.timezone),
    screen         = coalesce(excluded.screen, v.screen),
    viewport       = coalesce(excluded.viewport, v.viewport),
    pixel_ratio    = coalesce(excluded.pixel_ratio, v.pixel_ratio),
    color_scheme   = coalesce(excluded.color_scheme, v.color_scheme),
    touch          = coalesce(excluded.touch, v.touch),
    cpu_cores      = coalesce(excluded.cpu_cores, v.cpu_cores),
    memory_gb      = coalesce(excluded.memory_gb, v.memory_gb),
    connection     = coalesce(excluded.connection, v.connection),
    first_referrer = coalesce(v.first_referrer, excluded.first_referrer),
    first_landing  = coalesce(v.first_landing, excluded.first_landing),
    utm_source     = coalesce(v.utm_source, excluded.utm_source),
    utm_medium     = coalesce(v.utm_medium, excluded.utm_medium),
    utm_campaign   = coalesce(v.utm_campaign, excluded.utm_campaign),
    utm_term       = coalesce(v.utm_term, excluded.utm_term),
    utm_content    = coalesce(v.utm_content, excluded.utm_content),
    last_path      = coalesce(excluded.last_path, v.last_path),
    consent        = coalesce(excluded.consent, v.consent);

  insert into visitor_sessions as x (id, visitor_id, user_id, pageviews, events, ip, country, city, browser, os, device_type,
                                     referrer, landing, utm_source, utm_medium, utm_campaign)
  values (v_sid, v_vid, v_uid, n_pv, n_ev, p->>'ip', p->>'country', p->>'city', p->>'browser', p->>'os', p->>'device_type',
          s->>'referrer', s->>'landing', s->>'utm_source', s->>'utm_medium', s->>'utm_campaign')
  on conflict (id) do update set
    last_seen = now(), pageviews = x.pageviews + n_pv, events = x.events + n_ev,
    user_id = coalesce(excluded.user_id, x.user_id),
    referrer = coalesce(x.referrer, excluded.referrer), landing = coalesce(x.landing, excluded.landing)
  returning (xmax = 0) into v_new;
  if v_new then update visitors set visits = visits + 1 where id = v_vid; end if;

  insert into visitor_events (visitor_id, session_id, user_id, type, name, path, title, props, created_at)
  select v_vid, v_sid, v_uid, left(e->>'type', 32), left(e->>'name', 160), left(e->>'path', 500), left(e->>'title', 200),
         coalesce(e->'props', '{}'::jsonb),
         greatest(now() - interval '1 day', least(now(), coalesce((e->>'ts')::timestamptz, now())))
  from jsonb_array_elements(v_ev) e
  where coalesce(e->>'type', '') <> '';

  -- first time this browser is seen signed in (or someone else signed in on it): give the earlier anonymous activity to that account
  if v_uid is not null and v_old is distinct from v_uid then
    perform public.link_visitor(v_vid, v_uid);
  end if;
end $$;

-- attaches a browser and its anonymous history to an account (used after sign-up and sign-in)
create or replace function public.link_visitor(p_vid uuid, p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.untracked(p_uid) then delete from visitors where id = p_vid; return; end if;
  update visitors set user_id = p_uid where id = p_vid;
  update visitor_sessions set user_id = p_uid where visitor_id = p_vid and user_id is null;
  update visitor_events set user_id = p_uid where visitor_id = p_vid and user_id is null;
end $$;

-- one event recorded by the server (sign-up, payment, download …) for a browser that already exists
create or replace function public.track_server_event(p_vid uuid, p_sid uuid, p_uid uuid, p_type text, p_name text, p_path text, p_props jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.untracked(p_uid) then delete from visitors where id = p_vid; return; end if;
  if not exists (select 1 from visitors where id = p_vid) then return; end if;
  if p_sid is not null and not exists (select 1 from visitor_sessions where id = p_sid) then p_sid := null; end if;
  insert into visitor_events (visitor_id, session_id, user_id, type, name, path, props)
  values (p_vid, p_sid, p_uid, left(p_type, 32), left(p_name, 160), left(p_path, 500), coalesce(p_props, '{}'::jsonb));
  update visitors set events = events + 1, last_seen = now() where id = p_vid;
  if p_sid is not null then update visitor_sessions set events = events + 1, last_seen = now() where id = p_sid; end if;
  if p_uid is not null then perform public.link_visitor(p_vid, p_uid); end if;
end $$;


-- ---------------------------------------------------------------- numbers for the admin overview (times in India)
create or replace function public.admin_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t0 timestamptz := ((now() at time zone 'Asia/Kolkata')::date - (p_days - 1)) at time zone 'Asia/Kolkata';
  today timestamptz := ((now() at time zone 'Asia/Kolkata')::date) at time zone 'Asia/Kolkata';
  r jsonb;
begin
  with ev as (select visitor_id, type, path, created_at from visitor_events where created_at >= t0),
  days as (select generate_series((now() at time zone 'Asia/Kolkata')::date - (p_days - 1), (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as d),
  per_day as (
    select (created_at at time zone 'Asia/Kolkata')::date as d, count(distinct visitor_id) as v, count(*) filter (where type = 'pageview') as pv
    from ev group by 1),
  sess as (select * from visitor_sessions where started_at >= t0),
  vis as (select * from visitors where last_seen >= t0)
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'visitors',     (select count(distinct visitor_id) from ev),
      'new_visitors', (select count(*) from visitors where first_seen >= t0),
      'returning',    (select count(*) from vis where visits > 1),
      'sessions',     (select count(*) from sess),
      'pageviews',    (select count(*) from ev where type = 'pageview'),
      'events',       (select count(*) from ev),
      'today',        (select count(distinct visitor_id) from ev where created_at >= today),
      'online',       (select count(*) from visitors where last_seen > now() - interval '5 minutes'),
      'signups',      (select count(*) from profiles where created_at >= t0),
      'avg_session_s',(select coalesce(round(avg(extract(epoch from last_seen - started_at))), 0) from sess)
    ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', days.d, 'visitors', coalesce(per_day.v, 0), 'pageviews', coalesce(per_day.pv, 0)) order by days.d), '[]'::jsonb)
              from days left join per_day on per_day.d = days.d),
    'pages', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select split_part(path, '?', 1) as k, count(*) as n, count(distinct visitor_id) as u from ev where type = 'pageview' group by 1 order by n desc limit 12) t),
    'referrers', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select coalesce(substring(referrer from '^[a-z]+://(?:www\.)?([^/:?#]+)'), 'Direct') as k, count(*) as n
              from sess group by 1 order by n desc limit 10) t),
    'campaigns', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select concat_ws(' / ', utm_source, utm_medium, utm_campaign) as k, count(*) as n
              from sess where utm_source is not null group by 1 order by n desc limit 8) t),
    'countries', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select coalesce(country, '??') as k, count(*) as n from vis group by 1 order by n desc limit 10) t),
    'cities', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select concat_ws(', ', city, country) as k, count(*) as n from vis where city is not null group by 1 order by n desc limit 10) t),
    'devices', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select coalesce(device_type, 'desktop') as k, count(*) as n from vis group by 1 order by n desc) t),
    'browsers', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select coalesce(browser, 'Unknown') as k, count(*) as n from vis group by 1 order by n desc limit 8) t),
    'os', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select coalesce(os, 'Unknown') as k, count(*) as n from vis group by 1 order by n desc limit 8) t),
    'actions', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select type as k, count(*) as n from ev where type not in ('pageview', 'leave') group by 1 order by n desc limit 12) t)
  ) into r;
  return r;
end $$;

revoke all on function public.track_ingest(jsonb) from public, anon, authenticated;
revoke all on function public.untracked(uuid) from public, anon, authenticated;
revoke all on function public.forget_tracking(uuid) from public, anon, authenticated;
grant execute on function public.untracked(uuid) to service_role;
grant execute on function public.forget_tracking(uuid) to service_role;
revoke all on function public.link_visitor(uuid, uuid) from public, anon, authenticated;
revoke all on function public.track_server_event(uuid, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_stats(int) from public, anon, authenticated;
grant execute on function public.track_ingest(jsonb) to service_role;
grant execute on function public.link_visitor(uuid, uuid) to service_role;
grant execute on function public.track_server_event(uuid, uuid, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.admin_stats(int) to service_role;


-- ---------------------------------------------------------------- customer reviews
create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 80),
  place       text check (char_length(place) <= 80),
  tool_slug   text references public.tools (slug) on delete set null,
  rating      int  not null default 5 check (rating between 1 and 5),
  body        text not null check (char_length(body) between 10 and 1000),
  verified    boolean not null default false,       -- the writer has a paid order
  source      text not null default 'site' check (source in ('site', 'admin')),
  status      text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  created_at  timestamptz not null default now()
);
create index if not exists testimonials_status_idx on public.testimonials (status, created_at desc);
alter table public.testimonials enable row level security;
drop policy if exists "published reviews are public" on public.testimonials;
create policy "published reviews are public" on public.testimonials for select using (status = 'published' or public.is_admin());
-- reviews are written through the server (it checks for a paid order), so there is no insert policy


-- ---------------------------------------------------------------- clear anything already recorded for untracked accounts
select public.forget_tracking(id) from public.profiles where track = false;
