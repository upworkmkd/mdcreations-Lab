import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { UUID_RE } from '@/lib/consent';
import { looksSpammy } from '@/lib/feedback.server';
import { orderTokenOk } from '@/lib/order-mail.server';
import { trackServer } from '@/lib/track.server';

const noStore = { 'Cache-Control': 'no-store' };
const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n) : '');
const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: noStore });

/** Feedback on one order, from the link in the order email. One note per order; sending again updates it. */
export async function POST(req: Request) {
  if (!supabaseConfigured()) return no('Feedback is not set up yet.', 503);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return no('Bad request'); }
  if (clean(b.website, 200)) return NextResponse.json({ ok: true }, { headers: noStore });   // the hidden field bots fill in
  const orderId = clean(b.orderId, 40);
  if (!UUID_RE.test(orderId) || !orderTokenOk(orderId, b.t)) return no('This link does not work. Please open it from your order email again.', 403);
  const rating = Number(b.rating), message = clean(b.message, 2000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return no('Pick how it went first.');
  if (looksSpammy(message)) return no('Please remove the links and send again.');

  const db = supabaseAdmin();
  const { data: o } = await db.from('orders').select('id, user_id, tool_slug').eq('id', orderId).maybeSingle();
  if (!o) return no('Order not found.', 404);
  const [{ data: who }, { data: had }] = await Promise.all([
    db.from('profiles').select('email, full_name').eq('id', o.user_id).maybeSingle(),
    db.from('feedback').select('id, created_at').eq('order_id', o.id).maybeSingle(),
  ]);
  if (had && Date.now() - new Date(had.created_at).getTime() < 3_000) return no('That was quick! Please wait a moment and send again.', 429);
  const h = await headers(), ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
  const row = {
    rating, message: message || null, name: who?.full_name || null, email: who?.email ?? null, tool_slug: o.tool_slug,
    page: `/feedback/order/${o.id}`, user_id: o.user_id, order_id: o.id, ip, user_agent: (h.get('user-agent') ?? '').slice(0, 400), status: 'new',
  };
  const { error } = had ? await db.from('feedback').update(row).eq('id', had.id) : await db.from('feedback').insert(row);
  if (error) { console.error('order feedback', error); return no('Could not send it just now. Please try again.', 500); }
  await trackServer('feedback', { name: `${rating}/5 · order`, userId: o.user_id, path: row.page, props: { rating, orderId: o.id } });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
