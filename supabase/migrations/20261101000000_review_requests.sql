-- MD Creations Labs: asking customers for a review after a completed order (download or delivered print).
-- The email links to a review page that needs no sign-in (the link is signed for that order).
-- Paste into the Supabase SQL editor and press Run (after the earlier migrations). Safe to run again.

alter table public.orders add column if not exists review_requested_at timestamptz;

-- which order a review came from (reviews written from a review request)
alter table public.testimonials add column if not exists order_id uuid references public.orders (id) on delete set null;

alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('order_customer', 'order_admin', 'test', 'print_customer', 'print_admin', 'print_printing', 'print_shipped',
                  'print_tracking', 'print_delivered', 'print_cancelled', 'followup_order', 'followup_subscription', 'sub_welcome', 'sub_admin',
                  'review_request'));
