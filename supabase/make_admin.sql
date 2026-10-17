-- Make an account the admin of MD Creations Labs.
-- 1. Sign up on the site with this email (and confirm it) first.
-- 2. Run the whole migration file once (supabase/migrations/...init.sql) if you have not yet.
-- 3. Paste this into the Supabase SQL editor and press Run.

-- creates the profile row if the account was made before the migration ran
insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
where lower(u.email) = lower('er.dhimanmanoj@gmail.com')
on conflict (id) do update set email = excluded.email;

update public.profiles set role = 'admin'
where lower(email) = lower('er.dhimanmanoj@gmail.com');

-- should show one row with role = admin
select p.id, p.email, p.role from public.profiles p where p.role = 'admin';
