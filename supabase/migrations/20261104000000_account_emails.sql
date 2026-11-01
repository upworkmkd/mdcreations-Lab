-- MD Creations Labs: account emails (confirm your email, sign-in link, password reset) are now sent by the site
-- through Resend instead of by Supabase, and the admin can email a user from Users → a user → Send email.
-- This only lets the email log record those emails. Paste into the Supabase SQL editor and press Run. Safe to run again.
--
-- Nothing to change in Supabase itself: keep Authentication → Sign In / Providers → Email → "Confirm email" turned ON.
-- The site creates accounts and links with the admin API, which never sends Supabase's own emails.

alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('order_customer', 'order_admin', 'test', 'print_customer', 'print_admin', 'print_printing', 'print_shipped',
                  'print_tracking', 'print_delivered', 'print_cancelled', 'followup_order', 'followup_subscription', 'sub_welcome', 'sub_admin',
                  'review_request', 'auth_confirm', 'auth_login', 'auth_reset', 'manual'));
