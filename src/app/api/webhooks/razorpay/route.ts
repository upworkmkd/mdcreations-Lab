import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/razorpay.server';
import { fulfilOrder, recordPayment } from '@/lib/fulfil.server';

export const maxDuration = 60;

// Safety net for buyers who close the tab before the browser reports back.
// Subscribe to `payment.captured` and `order.paid` in the Razorpay dashboard.
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-razorpay-signature') ?? '';
  if (!sig || !verifyWebhookSignature(raw, sig)) return NextResponse.json({ error: 'bad signature' }, { status: 400 });

  const evt = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string } } } };
  const pay = evt.payload?.payment?.entity;
  if (!pay?.order_id || !['payment.captured', 'order.paid'].includes(evt.event)) return NextResponse.json({ ok: true });

  const db = supabaseAdmin();
  const { data: order } = await db.from('orders').select('*').eq('provider_order_id', pay.order_id).maybeSingle();
  if (!order) return NextResponse.json({ ok: true });
  try {
    if (order.status === 'created') await recordPayment(order, pay.id);
    if (order.status !== 'fulfilled') await fulfilOrder(order.id);
  } catch (e) {
    // Answer 500 so Razorpay retries later.
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
