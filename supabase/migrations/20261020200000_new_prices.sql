-- MD Creations Labs: new prices (20 October 2026).
--   Single design ₹199 / $3 · Starter ₹999 / $12 a month, every tool, 10 designs a day in total · Standard ₹1,999 / $24 a month, unlimited.
-- Paste into the Supabase SQL editor and press Run. Running it again is harmless.
-- Razorpay plans cannot change price: a changed price drops its old Razorpay plan id here, and a new
-- Razorpay plan is made automatically (by the first subscriber, or when you press Save in Admin → Plans).
-- People already subscribed keep paying their old price.

update public.tool_prices set amount_minor = 19900, updated_at = now() where tool_slug = 'shadow-lamp' and currency = 'INR';
update public.tool_prices set amount_minor = 300,   updated_at = now() where tool_slug = 'shadow-lamp' and currency = 'USD';

update public.plans set tools = null, daily_limit = 10,   status = 'live', updated_at = now() where id = 'starter';
update public.plans set tools = null, daily_limit = null, status = 'live', updated_at = now() where id = 'standard';

insert into public.plan_prices as pp (plan_id, currency, amount_minor) values
  ('starter',  'INR',  99900), ('starter',  'USD', 1200),
  ('standard', 'INR', 199900), ('standard', 'USD', 2400)
on conflict (plan_id, currency) do update
  set amount_minor = excluded.amount_minor,
      razorpay_plan_id = case when pp.amount_minor = excluded.amount_minor then pp.razorpay_plan_id end,
      updated_at = now();
