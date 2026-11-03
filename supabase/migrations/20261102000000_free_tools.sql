-- MD Creations Labs: mark any tool as free from Admin → Tools and prices.
-- A free tool is listed with the free tools and its designs download at no charge (sign-in still needed for makers).
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
alter table public.tools add column if not exists free boolean not null default false;
-- the two browser-only utilities have always been free
update public.tools set free = true where slug in ('print-cost', 'qr-code');
