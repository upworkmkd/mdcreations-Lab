-- MD Creations Labs: richer visitor list (referral, time on site, new or returning, score, device, pictures)
-- and copies of pictures loaded into the tools (unless the visitor unticks the box; kept for 10 days, admin only).
-- Paste into the Supabase SQL editor and press Run (after the earlier migrations). Safe to run again.


-- ---------------------------------------------------------------- pictures visitors chose to share
-- Saved while "Keep a copy of my picture for 10 days" is ticked under the upload (ticked unless the visitor unticks it).
create table if not exists public.shared_pictures (
  id            uuid primary key default gen_random_uuid(),
  visitor_id    uuid references public.visitors (id) on delete set null,   -- when they also accepted analytics cookies
  user_id       uuid references auth.users (id) on delete set null,
  tool          text not null check (char_length(tool) between 1 and 40),
  name          text check (char_length(name) <= 120),                    -- the original file name, without the extension
  width         int,
  height        int,
  bytes         int,
  storage_path  text not null,
  ip            text,
  created_at    timestamptz not null default now()
);
create index if not exists shared_pictures_created_idx on public.shared_pictures (created_at desc);
create index if not exists shared_pictures_visitor_idx on public.shared_pictures (visitor_id, created_at desc);
create index if not exists shared_pictures_ip_idx on public.shared_pictures (ip, created_at desc);
alter table public.shared_pictures enable row level security;
drop policy if exists "admins read shared pictures" on public.shared_pictures;
create policy "admins read shared pictures" on public.shared_pictures for select using (public.is_admin());
-- written and deleted only by the server with the service key
revoke all on public.shared_pictures from anon, authenticated;
grant select, insert, update, delete on public.shared_pictures to service_role;

-- private bucket: nothing in it is public, so nothing can be indexed; admins see pictures through the site
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-pictures', 'lab-pictures', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;


-- ---------------------------------------------------------------- the visitor list, with the numbers worked out
-- score (0-100): how far a visitor got. Pages and clicks count a little, choosing a picture and saving a
-- design more, and checkout, sign-up, payment and downloads the most.
create or replace view public.visitor_overview with (security_invoker = true) as
select v.*,
  coalesce(s.seconds, 0)::int                                as time_s,
  coalesce(e.pictures, 0)::int                               as pictures_chosen,
  coalesce(k.kept, 0)::int                                   as pictures_kept,
  coalesce(substring(v.first_referrer from '^[a-z]+://(?:www\.)?([^/:?#]+)'),
           case when v.utm_source is not null then 'utm: ' || v.utm_source end) as referral,
  least(100, round(
      least(v.pageviews, 20) * 1
    + least(coalesce(e.clicks, 0), 20) * 0.5
    + least(coalesce(e.inputs, 0), 20) * 0.5
    + least(coalesce(e.pictures, 0), 3) * 6
    + least(coalesce(e.designs, 0), 3) * 10
    + least(coalesce(e.checkouts, 0), 2) * 12
    + least(coalesce(e.signups, 0), 1) * 15
    + least(coalesce(e.signins, 0), 1) * 5
    + least(coalesce(e.payments, 0), 2) * 30
    + least(coalesce(e.downloads, 0), 3) * 12
    + least(coalesce(e.reviews, 0), 1) * 8
    + least(coalesce(s.seconds, 0) / 60.0, 30) * 0.5
    + case when v.visits > 1 then 5 else 0 end
  ))::int                                                    as score
from public.visitors v
left join lateral (
  select sum(extract(epoch from (x.last_seen - x.started_at))) as seconds from public.visitor_sessions x where x.visitor_id = v.id
) s on true
left join lateral (
  select
    count(*) filter (where t.type = 'file' and coalesce(t.props->>'type', '') like 'image/%') as pictures,
    count(*) filter (where t.type = 'click')                                                  as clicks,
    count(*) filter (where t.type = 'input')                                                  as inputs,
    count(*) filter (where t.type = 'design_saved')                                           as designs,
    count(*) filter (where t.type in ('checkout', 'subscribe_start'))                         as checkouts,
    count(*) filter (where t.type = 'signup')                                                 as signups,
    count(*) filter (where t.type = 'signin')                                                 as signins,
    count(*) filter (where t.type in ('payment', 'subscribed'))                               as payments,
    count(*) filter (where t.type in ('download', 'free_download', 'plan_build'))             as downloads,
    count(*) filter (where t.type = 'review')                                                 as reviews
  from public.visitor_events t where t.visitor_id = v.id
) e on true
left join lateral (
  select count(*) as kept from public.shared_pictures p where p.visitor_id = v.id
) k on true;

revoke all on public.visitor_overview from public, anon, authenticated;
grant select on public.visitor_overview to service_role;


-- ---------------------------------------------------------------- the nightly clean-up also forgets shared pictures after 10 days
-- (the files themselves are removed by the site, which holds the storage key; see /api/pictures)
create or replace function public.expired_pictures(p_days int default 10, p_limit int default 200)
returns setof public.shared_pictures language sql stable security definer set search_path = public as $$
  select * from shared_pictures where created_at < now() - make_interval(days => p_days) order by created_at limit p_limit;
$$;
revoke all on function public.expired_pictures(int, int) from public, anon, authenticated;
grant execute on function public.expired_pictures(int, int) to service_role;
