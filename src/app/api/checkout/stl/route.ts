import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createOrder } from '@/lib/razorpay.server';
import { fulfilOrder } from '@/lib/fulfil.server';
import { adminPaysForReal, getCurrency } from '@/lib/catalog.server';
import { serverEnv } from '@/lib/env';
import { trackServer } from '@/lib/track.server';
import { checkShipTo } from '@/lib/ship';

export const maxDuration = 60;

/**
 * Buying from the STL shop. mode "download": the STL files (price per currency, set in Admin → STL files).
 * mode "print": printed and posted within India (₹ only). Prices always come from the database, never the browser.
 * A customer who already owns the files gets them again instead of paying twice.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  const user = auth.user;

  let body: { productId?: string; mode?: string; shipTo?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const mode = body.mode === 'print' ? 'print' : 'download';
  if (!body.productId || !/^[0-9a-f-]{36}$/i.test(body.productId)) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const db = supabaseAdmin();
  const [{ data: p }, { data: profile }] = await Promise.all([
    db.from('stl_products').select('id, slug, title, status, price_inr, price_usd, print_price_inr, package_path').eq('id', body.productId).maybeSingle(),
    db.from('profiles').select('role, full_name').eq('id', user.id).single(),
  ]);
  const admin = profile?.role === 'admin';
  if (!p || (p.status !== 'live' && !admin)) return NextResponse.json({ error: 'This design is not available right now.' }, { status: 409 });

  let currency = await getCurrency(), price: number | null, ship: ReturnType<typeof checkShipTo> | null = null;
  if (mode === 'print') {
    ship = checkShipTo(body.shipTo);
    if (!ship.ok) return NextResponse.json({ error: 'Please check the address.', fields: ship.errors }, { status: 400 });
    if (currency !== 'INR') return NextResponse.json({ error: 'Printed orders are posted within India only for now.' }, { status: 409 });
    price = p.print_price_inr;
    if (price == null) return NextResponse.json({ error: 'Printed orders are not offered for this design yet.' }, { status: 409 });
    await db.from('profiles').update({ ship_to: ship.value }).eq('id', user.id);
  } else {
    price = currency === 'INR' ? p.price_inr : p.price_usd;
    if (price == null) return NextResponse.json({ error: `This design is not sold in ${currency} yet. Please contact us.` }, { status: 409 });
    if (!p.package_path) return NextResponse.json({ error: 'The files for this design are being prepared. Please try again later.' }, { status: 409 });
    // already bought: hand back the same files, no second payment
    const { data: owned } = await db.from('files').select('id, order_id').eq('user_id', user.id).eq('product_id', p.id).limit(1).maybeSingle();
    if (owned) return NextResponse.json({ free: true, owned: true, fileId: owned.id, orderId: owned.order_id });
  }

  // the shop owner's own orders are free, unless "Admin orders: pay with Razorpay" is on to test the real checkout
  const isAdmin = admin && !(await adminPaysForReal());
  const amount = isAdmin ? 0 : price;
  if (mode === 'print') currency = 'INR';
  const { data: order, error } = await db.from('orders').insert({
    user_id: user.id, product_id: p.id, design_id: null, tool_slug: 'stl', currency, amount_minor: amount, kind: mode,
    ...(ship?.ok ? { ship_to: ship.value } : {}),
    status: amount === 0 ? 'paid' : 'created', provider: amount === 0 ? (isAdmin ? 'admin' : 'free') : 'razorpay', paid_at: amount === 0 ? new Date().toISOString() : null,
  }).select('id').single();
  if (error || !order) return NextResponse.json({ error: 'Could not start the order. Please try again.' }, { status: 500 });

  await trackServer('checkout', { name: `${mode === 'print' ? 'Printed: ' : 'STL: '}${p.title}`, userId: user.id, props: { orderId: order.id, productId: p.id, amount, currency, tool: 'stl', kind: mode } });

  if (amount === 0) {
    try {
      const fileId = await fulfilOrder(order.id);
      return NextResponse.json({ free: true, fileId, orderId: order.id });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message, orderId: order.id }, { status: 500 });
    }
  }
  try {
    const rzp = await createOrder(amount, currency, order.id.slice(0, 36), { order_id: order.id, product: p.slug, kind: mode });
    await db.from('orders').update({ provider_order_id: rzp.id }).eq('id', order.id);
    return NextResponse.json({
      keyId: serverEnv('RAZORPAY_KEY_ID'), providerOrderId: rzp.id, orderId: order.id, amount, currency,
      description: mode === 'print' ? `${p.title} (printed and posted)` : `${p.title} – STL files`,
      prefill: { name: (ship?.ok ? ship.value.name : '') || profile?.full_name || '', email: user.email ?? '', ...(ship?.ok ? { contact: `+91${ship.value.phone}` } : {}) },
    });
  } catch (e) {
    await db.from('orders').update({ status: 'failed', error: (e as Error).message.slice(0, 500) }).eq('id', order.id);
    return NextResponse.json({ error: 'The payment could not be started: ' + (e as Error).message }, { status: 502 });
  }
}
