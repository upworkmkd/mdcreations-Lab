import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyWebhookSignature, type RzpSubscription } from '@/lib/razorpay.server';
import { fulfilOrder, recordPayment } from '@/lib/fulfil.server';
import { syncSubscription } from '@/lib/plans.server';

export const maxDuration = 60;

type Evt = {
  event: string;
  payload?: {
    payment?: { entity?: { id: string; order_id: string; amount: number; currency: string; status: string; method?: string } };
    subscription?: { entity?: RzpSubscription };
  };
};

// Razorpay webhooks. Subscribe to these events in the Razorpay dashboard:
//   payment.captured, order.paid                       – one-off purchases (safety net if the tab closes)
//   subscription.authenticated, subscription.activated, subscription.charged, subscription.pending,
//   subscription.halted, subscription.cancelled, subscription.completed, subscription.paused, subscription.resumed
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-razorpay-signature') ?? '';
  if (!sig || !verifyWebhookSignature(raw, sig)) return NextResponse.json({ error: 'bad signature' }, { status: 400 });

  const evt = JSON.parse(raw) as Evt;
  const db = supabaseAdmin();

  // ---------------------------------------------------------------- monthly plans
  if (evt.event.startsWith('subscription.')) {
    const s = evt.payload?.subscription?.entity;
    if (!s) return NextResponse.json({ ok: true });
    const row = await syncSubscription(s);
    const pay = evt.payload?.payment?.entity;
    if (row && pay && evt.event === 'subscription.charged') {
      await db.from('payments').upsert({
        order_id: null, subscription_id: row.id, user_id: row.user_id, provider_payment_id: pay.id,
        amount_minor: pay.amount, currency: pay.currency, status: pay.status, method: pay.method ?? null,
      }, { onConflict: 'provider_payment_id' });
    }
    return NextResponse.json({ ok: true });
  }

  // ---------------------------------------------------------------- one-off purchases
  const pay = evt.payload?.payment?.entity;
  if (!pay?.order_id || !['payment.captured', 'order.paid'].includes(evt.event)) return NextResponse.json({ ok: true });
  const { data: order } = await db.from('orders').select('*').eq('provider_order_id', pay.order_id).maybeSingle();
  if (!order) return NextResponse.json({ ok: true });   // e.g. a plan renewal: handled by subscription.charged
  try {
    if (order.status === 'created') await recordPayment(order, pay.id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });   // Razorpay retries later
  }
  try {
    if (order.status !== 'fulfilled') await fulfilOrder(order.id);
  } catch (e) {
    // a printed order whose files failed to build is still paid; the shop rebuilds it from the admin
    if (order.kind === 'print') return NextResponse.json({ ok: true });
    // Answer 500 so Razorpay retries later.
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
