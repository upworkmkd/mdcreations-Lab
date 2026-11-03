import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { UUID_RE } from '@/lib/consent';
import { looksSpammy } from '@/lib/feedback.server';
import { reviewTokenOk } from '@/lib/review-request.server';
import { trackServer } from '@/lib/track.server';

const noStore = { 'Cache-Control': 'no-store' };
const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n) : '');
const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: noStore });

/**
 * A review from the link in a review-request email: one review per customer (the order's account). A new review,
 * or changes to one that is still waiting for the shop. It waits for the shop to publish it, like any review.
 */
export async function POST(req: Request) {
  if (!supabaseConfigured()) return no('Reviews are not set up yet.', 503);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return no('Bad request'); }
  if (clean(b.website, 200)) return NextResponse.json({ ok: true }, { headers: noStore });
  const orderId = clean(b.orderId, 40);
  if (!UUID_RE.test(orderId) || !reviewTokenOk(orderId, b.t)) return no('This link does not work. Please open it from the email again.', 403);
  const rating = Math.round(Number(b.rating)), body = clean(b.body, 1000), name = clean(b.name, 80), place = clean(b.place, 80);
  if (!(rating >= 1 && rating <= 5)) return no('Please choose a star rating.');
  if (body.length < 10) return no('Please write at least a sentence.');
  if (!name) return no('Please add the name to show with your review.');
  if (looksSpammy(body)) return no('Please remove the links and send again.');

  const db = supabaseAdmin();
  const { data: o } = await db.from('orders').select('id, user_id, tool_slug, status, amount_minor').eq('id', orderId).maybeSingle();
  if (!o) return no('Order not found.', 404);
  const { data: had } = await db.from('testimonials').select('id, status').eq('user_id', o.user_id).eq('source', 'site').maybeSingle();
  const row = { name, place: place || null, body, rating };
  let id: string;
  if (had) {
    if (had.status === 'published') return NextResponse.json({ ok: true, id: had.id, kept: true }, { headers: noStore });   // already on the site: photos can still be added
    const { error } = await db.from('testimonials').update(row).eq('id', had.id);
    if (error) return no('Could not save your review. Please try again.', 500);
    id = had.id;
  } else {
    const paid = o.status === 'fulfilled' || o.status === 'paid';
    const { data, error } = await db.from('testimonials').insert({ ...row, user_id: o.user_id, tool_slug: o.tool_slug, order_id: o.id, verified: paid, source: 'site', status: 'pending' }).select('id').single();
    if (error || !data) return no(error?.code === '23505' ? 'You have already sent us a review. Thank you!' : 'Could not save your review. Please try again.', 500);
    id = data.id;
  }
  await trackServer('review', { name: `${rating}★ (from review email)`, userId: o.user_id, props: { rating, orderId } });
  revalidatePath('/admin/reviews');
  return NextResponse.json({ ok: true, id }, { headers: noStore });
}
