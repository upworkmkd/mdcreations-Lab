import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { UUID_RE } from '@/lib/consent';
import { looksSpammy } from '@/lib/feedback.server';
import { planTokenOk } from '@/lib/subscription-mail.server';
import { trackServer } from '@/lib/track.server';

const noStore = { 'Cache-Control': 'no-store' };
const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n) : '');
const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: noStore });

/** Feedback on a plan, from the link in the welcome email. One note per plan; sending again updates it. */
export async function POST(req: Request) {
  if (!supabaseConfigured()) return no('Feedback is not set up yet.', 503);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return no('Bad request'); }
  if (clean(b.website, 200)) return NextResponse.json({ ok: true }, { headers: noStore });
  const id = clean(b.subscriptionId, 40);
  if (!UUID_RE.test(id) || !planTokenOk(id, b.t)) return no('This link does not work. Please open it from your plan email again.', 403);
  const rating = Number(b.rating), message = clean(b.message, 2000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return no('Pick how it is going first.');
  if (looksSpammy(message)) return no('Please remove the links and send again.');
  const db = supabaseAdmin();
  const { data: s } = await db.from('subscriptions').select('id, user_id, plan_id').eq('id', id).maybeSingle();
  if (!s) return no('Plan not found.', 404);
  const [{ data: who }, { data: had }] = await Promise.all([
    db.from('profiles').select('email, full_name').eq('id', s.user_id).maybeSingle(),
    db.from('feedback').select('id').eq('subscription_id', id).maybeSingle(),
  ]);
  const h = await headers(), ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
  const row = {
    rating, message: message || null, name: who?.full_name || null, email: who?.email ?? null, tool_slug: null,
    page: `/feedback/plan/${id}`, user_id: s.user_id, subscription_id: id, ip, user_agent: (h.get('user-agent') ?? '').slice(0, 400), status: 'new',
  };
  const { error } = had ? await db.from('feedback').update(row).eq('id', had.id) : await db.from('feedback').insert(row);
  if (error) { console.error('plan feedback', error); return no('Could not send it just now. Please try again.', 500); }
  await trackServer('feedback', { name: `${rating}/5 · ${s.plan_id} plan`, userId: s.user_id, path: row.page, props: { rating, subscriptionId: id } });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
