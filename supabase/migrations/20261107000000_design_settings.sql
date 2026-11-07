-- MD Creations Labs: "Edit design" in the account.
-- Paste the whole file into the Supabase SQL editor and press Run. Safe to run again.
--
-- designs.params is what the server needs to build the files. designs.settings is what the maker needs to open the
-- design again exactly as it was: every setting, the colours and the original picture (as a small data URL).
-- Older designs have no settings; the makers rebuild what they can from params.

alter table public.designs add column if not exists settings jsonb;

comment on column public.designs.settings is 'The maker''s own settings (and source picture) to open the design again for editing; null for older designs.';
