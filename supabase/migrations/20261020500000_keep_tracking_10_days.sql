-- MD Creations Labs: keep visitor tracking for 10 days only.
-- Paste into the Supabase SQL editor and press Run. Safe to run again.
-- Removes visitors, visits, activity events and anonymous page views older than 10 days, every night at 3:00 India time.
-- Accounts, designs, orders, payments, files, downloads and reviews are never touched.

create or replace function public.purge_old_tracking(p_days int default 10)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cutoff timestamptz := now() - make_interval(days => p_days);
  n_events int; n_sessions int; n_visitors int; n_anon int;
begin
  delete from visitor_events where created_at < cutoff;
  get diagnostics n_events = row_count;
  delete from visitor_sessions where last_seen < cutoff;
  get diagnostics n_sessions = row_count;
  delete from visitors where last_seen < cutoff;            -- their remaining visits and events go with them
  get diagnostics n_visitors = row_count;
  delete from anon_views where created_at < cutoff;
  get diagnostics n_anon = row_count;

  -- browsers still active keep a profile, but its counts now only cover the last 10 days
  if n_events > 0 or n_sessions > 0 then
    update visitors v set
      first_seen = coalesce((select min(started_at) from visitor_sessions s where s.visitor_id = v.id), v.first_seen),
      visits     = (select count(*) from visitor_sessions s where s.visitor_id = v.id),
      pageviews  = (select count(*) from visitor_events e where e.visitor_id = v.id and e.type = 'pageview'),
      events     = (select count(*) from visitor_events e where e.visitor_id = v.id)
    where v.first_seen < cutoff;
  end if;
  return jsonb_build_object('events', n_events, 'sessions', n_sessions, 'visitors', n_visitors, 'anonymous', n_anon);
end $$;

revoke all on function public.purge_old_tracking(int) from public, anon, authenticated;
grant execute on function public.purge_old_tracking(int) to service_role;

-- clear the backlog now
select public.purge_old_tracking(10);

-- run it every night at 03:00 India time (21:30 UTC) with pg_cron, which comes with Supabase.
-- If it says pg_cron could not be turned on, turn on "Cron" under Integrations (or Database → Extensions → pg_cron) and run the file again.
do $$
begin
  begin
    execute 'create extension if not exists pg_cron with schema pg_catalog';
  exception when others then
    raise notice 'pg_cron could not be turned on here (%). Turn it on in the Supabase dashboard and run this file again.', sqlerrm;
    return;
  end;
  perform cron.unschedule(jobid) from cron.job where jobname = 'purge-old-tracking';
  perform cron.schedule('purge-old-tracking', '30 21 * * *', 'select public.purge_old_tracking(10)');
  raise notice 'Nightly clean-up scheduled.';
end $$;
