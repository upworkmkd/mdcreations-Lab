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
 * Starts a printed order: the design is printed, assembled and posted to the address given. India only for now.
 * The price comes from the database (Tools and prices → Printed), never from the browser, and is not covered by plans.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  const user = auth.user;

  let body: { designId?: string; shipTo?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  if (!body.designId) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  const ship = checkShipTo(body.shipTo);
  if (!ship.ok) return NextResponse.json({ error: 'Please check the address.', fields: ship.errors }, { status: 400 });

  const currency = await getCurrency();
  if (currency !== 'INR') return NextResponse.json({ error: 'Printed orders are posted within India only for now.' }, { status: 409 });

  const { data: design } = await supabase.from('designs').select('id, tool_slug, name').eq('id', body.designId).maybeSingle();
  if (!design) return NextResponse.json({ error: 'Design not found.' }, { status: 404 });

  const db = supabaseAdmin();
  const [{ data: tool }, { data: price }, { data: profile }] = await Promise.all([
    db.from('tools').select('status, name').eq('slug', design.tool_slug).single(),
    db.from('tool_print_prices').select('amount_minor').eq('tool_slug', design.tool_slug).eq('currency', currency).maybeSingle(),
    db.from('profiles').select('role, full_name').eq('id', user.id).single(),
  ]);
  if (!tool || (tool.status !== 'live' && profile?.role !== 'admin')) return NextResponse.json({ error: 'This tool is not available right now.' }, { status: 409 });
  if (!price) return NextResponse.json({ error: 'Printed orders are not offered for this tool yet.' }, { status: 409 });

  // remembered for next time
  await db.from('profiles').update({ ship_to: ship.value }).eq('id', user.id);

  // the shop owner's own orders are free, unless "Admin orders: pay with Razorpay" is on to test the real checkout
  const isAdmin = profile?.role === 'admin' && !(await adminPaysForReal());
  const amount = isAdmin ? 0 : price.amount_minor;
  const { data: order, error } = await db.from('orders').insert({
    user_id: user.id, design_id: design.id, tool_slug: design.tool_slug, currency, amount_minor: amount, kind: 'print', ship_to: ship.value,
    status: amount === 0 ? 'paid' : 'created', provider: amount === 0 ? 'admin' : 'razorpay', paid_at: amount === 0 ? new Date().toISOString() : null,
  }).select('id').single();
  if (error || !order) return NextResponse.json({ error: 'Could not start the order. Please try again.' }, { status: 500 });

  await trackServer('checkout', { name: `Printed: ${design.name}`, userId: user.id, props: { orderId: order.id, designId: design.id, amount, currency, tool: design.tool_slug, kind: 'print', pin: ship.value.pin } });

  if (amount === 0) {
    try {
      await fulfilOrder(order.id);
      return NextResponse.json({ free: true, orderId: order.id });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message, orderId: order.id }, { status: 500 });
    }
  }

  try {
    const rzp = await createOrder(amount, currency, order.id.slice(0, 36), { order_id: order.id, design: design.name, tool: design.tool_slug, kind: 'print' });
    await db.from('orders').update({ provider_order_id: rzp.id }).eq('id', order.id);
    return NextResponse.json({
      keyId: serverEnv('RAZORPAY_KEY_ID'), providerOrderId: rzp.id, orderId: order.id, amount, currency,
      description: `${tool.name} – ${design.name} (printed and posted)`,
      prefill: { name: ship.value.name || profile?.full_name || '', email: user.email ?? '', contact: `+91${ship.value.phone}` },
    });
  } catch (e) {
    await db.from('orders').update({ status: 'failed', error: (e as Error).message.slice(0, 500) }).eq('id', order.id);
    return NextResponse.json({ error: 'The payment could not be started: ' + (e as Error).message }, { status: 502 });
  }
}

/** The signed-in customer's last shipping address, to fill the form in. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ shipTo: null }, { headers: { 'Cache-Control': 'no-store' } });
  const { data } = await supabaseAdmin().from('profiles').select('ship_to, full_name').eq('id', auth.user.id).maybeSingle();
  return NextResponse.json({ shipTo: data?.ship_to ?? null, name: data?.full_name ?? '' }, { headers: { 'Cache-Control': 'no-store' } });
}
