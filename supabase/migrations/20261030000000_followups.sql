-- MD Creations Labs: follow-up emails to customers who did not finish paying, an email history per customer,
-- and a welcome email for new plans (with a feedback link).
-- Paste into the Supabase SQL editor and press Run (after the earlier migrations). Safe to run again.


-- ---------------------------------------------------------------- the email log: who it was for, and what a hand-written email said
alter table public.email_log add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.email_log add column if not exists subscription_id uuid references public.subscriptions (id) on delete set null;
alter table public.email_log add column if not exists body text check (char_length(body) <= 10000);   -- follow-ups only: the text that was sent
alter table public.email_log add column if not exists sent_by uuid references auth.users (id) on delete set null;
create index if not exists email_log_user_idx on public.email_log (user_id, created_at desc);
create index if not exists email_log_to_idx on public.email_log (lower(to_email), created_at desc);

alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('order_customer', 'order_admin', 'test', 'print_customer', 'print_admin', 'print_printing', 'print_shipped',
                  'print_tracking', 'print_delivered', 'print_cancelled', 'followup_order', 'followup_subscription', 'sub_welcome', 'sub_admin'));

-- older rows: fill in the customer from the order
update public.email_log l set user_id = o.user_id from public.orders o where l.order_id = o.id and l.user_id is null and l.kind not in ('order_admin', 'print_admin');


-- ---------------------------------------------------------------- the welcome email for a plan goes out once
alter table public.subscriptions add column if not exists welcomed_at timestamptz;
alter table public.subscriptions add column if not exists admin_notified_at timestamptz;

-- feedback from the link in the welcome email
alter table public.feedback add column if not exists subscription_id uuid references public.subscriptions (id) on delete set null;
create unique index if not exists feedback_subscription_uidx on public.feedback (subscription_id) where subscription_id is not null;
