-- MD Creations Labs: photos on reviews. Customers add up to 4 photos of what they printed; each photo waits for
-- the shop to approve it, then shows with the review on the tool pages.
-- Paste into the Supabase SQL editor and press Run (after the earlier migrations). Safe to run again.

create table if not exists public.review_photos (
  id              uuid primary key default gen_random_uuid(),
  testimonial_id  uuid not null references public.testimonials (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete set null,
  storage_path    text not null,
  width           int,
  height          int,
  bytes           int,
  status          text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  sort            int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists review_photos_review_idx on public.review_photos (testimonial_id, sort, created_at);
create index if not exists review_photos_status_idx on public.review_photos (status, created_at desc);
alter table public.review_photos enable row level security;
drop policy if exists "published review photos are public" on public.review_photos;
create policy "published review photos are public" on public.review_photos for select using (status = 'published' or public.is_admin());
revoke insert, update, delete on public.review_photos from anon, authenticated;
grant select on public.review_photos to anon, authenticated;
grant select, insert, update, delete on public.review_photos to service_role;

-- private bucket: the site serves a photo only once it is approved (and to admins), so nothing leaks before that
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
