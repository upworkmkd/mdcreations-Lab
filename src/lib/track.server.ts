import 'server-only';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { CONSENT_COOKIE, NOTRACK_COOKIE, SESSION_COOKIE, UUID_RE, VISITOR_COOKIE } from '@/lib/consent';

/** The visitor and visit ids of the browser making this request, when the visitor allowed tracking. */
export async function trackingIds() {
  const jar = await cookies();
  if (jar.get(CONSENT_COOKIE)?.value !== 'all' || jar.get(NOTRACK_COOKIE)) return null;
  const vid = jar.get(VISITOR_COOKIE)?.value, sid = jar.get(SESSION_COOKIE)?.value;
  if (!vid || !UUID_RE.test(vid)) return null;
  return { vid, sid: sid && UUID_RE.test(sid) ? sid : null };
}

/**
 * Adds one server-side event (sign-up, payment, download …) to the visitor's timeline.
 * Never throws: tracking must not break a purchase.
 */
export async function trackServer(type: string, opts: { name?: string; path?: string; userId?: string | null; props?: Record<string, unknown> } = {}) {
  try {
    if (!supabaseConfigured()) return;
    const ids = await trackingIds();
    if (!ids) return;
    await supabaseAdmin().rpc('track_server_event', {
      p_vid: ids.vid, p_sid: ids.sid, p_uid: opts.userId ?? null, p_type: type,
      p_name: opts.name ?? null, p_path: opts.path ?? null, p_props: opts.props ?? {},
    });
  } catch { /* ignore */ }
}

/** Gives this browser's earlier anonymous activity to the account that just signed up or in. */
export async function linkVisitor(userId: string) {
  try {
    if (!supabaseConfigured()) return;
    const ids = await trackingIds();
    if (!ids) return;
    await supabaseAdmin().rpc('link_visitor', { p_vid: ids.vid, p_uid: userId });
  } catch { /* ignore */ }
}
