-- MD Creations Labs: automatic emails, sent once a day by a scheduled job (see vercel.json and /api/cron/emails):
-- a review request some days after a completed order, and a follow-up some days after an unpaid order or an
-- unfinished plan. Turned on and timed in Admin → Settings. Each order or plan gets each email at most once.
-- Paste into the Supabase SQL editor and press Run (after the earlier migrations). Safe to run again.

-- emails the site sent by itself (not written by hand in the admin)
alter table public.email_log add column if not exists auto boolean not null default false;

-- off until you turn them on in Settings
insert into public.site_settings (key, value)
values ('automation', '{"review": {"on": false, "daysDownload": 5, "daysPrint": 3}, "unpaidOrder": {"on": false, "days": 2}, "unpaidPlan": {"on": false, "days": 2}, "signer": ""}'::jsonb)
on conflict (key) do nothing;
