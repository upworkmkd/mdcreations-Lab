import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchPayment, fetchSubscription, verifySubscriptionSignature } from '@/lib/razorpay.server';
import { syncSubscription } from '@/lib/plans.server';
import { trackServer } from '@/lib/track.server';

// Called by the browser right after the subscription checkout succeeds.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  let b: { razorpay_payment_id?: string; razorpay_subscription_id?: string; razorpay_signature?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  if (!b.razorpay_payment_id || !b.razorpay_subscription_id || !b.razorpay_signature) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  if (!verifySubscriptionSignature(b.razorpay_payment_id, b.razorpay_subscription_id, b.razorpay_signature)) return NextResponse.json({ error: 'The payment could not be verified.' }, { status: 400 });

  const db = supabaseAdmin();
  const { data: row } = await db.from('subscriptions').select('*').eq('provider_subscription_id', b.razorpay_subscription_id).maybeSingle();
  if (!row || row.user_id !== auth.user.id) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });

  const [r, pay] = await Promise.all([fetchSubscription(b.razorpay_subscription_id), fetchPayment(b.razorpay_payment_id)]);
  let synced = await syncSubscription(r);
  // Razorpay can take a moment to move to "active"; a verified first payment is enough to open the plan for a month.
  if (synced && !synced.current_end) {
    const end = new Date(); end.setMonth(end.getMonth() + 1);
    const { data } = await db.from('subscriptions').update({ status: r.status === 'created' ? 'authenticated' : r.status, current_start: new Date().toISOString(), current_end: end.toISOString() }).eq('id', row.id).select('*').single();
    synced = data;
  }
  await db.from('payments').upsert({
    order_id: null, subscription_id: row.id, user_id: row.user_id, provider_payment_id: pay.id, amount_minor: pay.amount, currency: pay.currency, status: pay.status, method: pay.method ?? null,
  }, { onConflict: 'provider_payment_id' });
  await trackServer('subscribed', { name: `${row.plan_id} plan`, userId: auth.user.id, props: { plan: row.plan_id, amount: pay.amount, currency: pay.currency, paymentId: pay.id } });
  return NextResponse.json({ ok: true, status: synced?.status });
}
