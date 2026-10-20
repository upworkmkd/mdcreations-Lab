import 'server-only';
import type { supabaseAdmin } from '@/lib/supabase/admin';

export const KEEP_TRACKING_DAYS = 10;
let lastRun = 0;

/** Deletes visitor data older than 10 days. The database does this every night; this is a backup, at most once an hour. */
export async function purgeOldTracking(db: ReturnType<typeof supabaseAdmin>) {
  if (Date.now() - lastRun < 3600_000) return;
  lastRun = Date.now();
  try { await db.rpc('purge_old_tracking', { p_days: KEEP_TRACKING_DAYS }); } catch { /* the nightly job still runs */ }
}
