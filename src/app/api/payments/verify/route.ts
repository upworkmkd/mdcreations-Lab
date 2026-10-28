import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCheckoutSignature } from '@/lib/razorpay.server';
import { fulfilOrder, recordPayment } from '@/lib/fulfil.server';
import { trackServer } from '@/lib/track.server';

export const maxDuration = 60;

// Called by the browser right after Razorpay Checkout succeeds.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  let b: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  if (!b.razorpay_order_id || !b.razorpay_payment_id || !b.razorpay_signature) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  if (!verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    return NextResponse.json({ error: 'The payment could not be verified.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: order } = await db.from('orders').select('*').eq('provider_order_id', b.razorpay_order_id).maybeSingle();
  if (!order || order.user_id !== auth.user.id) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  try {
    if (order.status === 'created') await recordPayment(order, b.razorpay_payment_id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, orderId: order.id }, { status: 500 });
  }
  const paid = { name: `Paid ${order.amount_minor / 100} ${order.currency}`, userId: auth.user.id, props: { orderId: order.id, paymentId: b.razorpay_payment_id, amount: order.amount_minor, currency: order.currency, kind: order.kind } };
  try {
    const fileId = await fulfilOrder(order.id);
    await trackServer('payment', { ...paid, props: { ...paid.props, fileId } });
    return NextResponse.json({ fileId, orderId: order.id, print: order.kind === 'print' });
  } catch (e) {
    // a printed order is paid even if its files could not be built yet: the shop rebuilds them from the admin
    if (order.kind === 'print') { await trackServer('payment', paid); return NextResponse.json({ fileId: '', orderId: order.id, print: true }); }
    return NextResponse.json({ error: (e as Error).message, orderId: order.id }, { status: 500 });
  }
}
