-- MD Creations Labs: feedback from the "How do you like it?" popup.
-- Paste into the Supabase SQL editor and press Run. Safe to run again.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  rating      int  not null check (rating between 1 and 5),          -- 1 = 😞 … 5 = 😍
  tool_slug   text check (char_length(tool_slug) <= 40),              -- the tool they were looking at, if any
  message     text check (char_length(message) <= 2000),              -- what we could do better
  name        text check (char_length(name) <= 80),                   -- optional
  email       text check (char_length(email) <= 160),                 -- optional
  page        text check (char_length(page) <= 300),
  visitor_id  uuid references public.visitors (id) on delete set null,
  user_id     uuid references auth.users (id) on delete set null,
  ip          text,
  user_agent  text check (char_length(user_agent) <= 400),
  status      text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at  timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);
create index if not exists feedback_ip_idx on public.feedback (ip, created_at desc);

alter table public.feedback enable row level security;
drop policy if exists "admins read feedback" on public.feedback;
create policy "admins read feedback" on public.feedback for select using (public.is_admin());
-- written only by the server (it checks for spam first)
revoke all on public.feedback from anon, authenticated;
grant select, insert, update, delete on public.feedback to service_role;
