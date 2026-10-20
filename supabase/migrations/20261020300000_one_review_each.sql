-- MD Creations Labs: one review per customer.
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- If someone already wrote more than one review, only their first is kept as theirs; the others stay but are unlinked from the account.

update public.testimonials t set user_id = null
where t.source = 'site' and t.user_id is not null
  and exists (select 1 from public.testimonials o where o.source = 'site' and o.user_id = t.user_id and o.created_at < t.created_at);

create unique index if not exists testimonials_one_per_user on public.testimonials (user_id) where source = 'site' and user_id is not null;
