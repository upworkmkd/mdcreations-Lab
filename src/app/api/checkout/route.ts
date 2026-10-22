import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createOrder } from '@/lib/razorpay.server';
import { fulfilOrder } from '@/lib/fulfil.server';
import { getCurrency } from '@/lib/catalog.server';
import { serverEnv } from '@/lib/env';
import { trackServer } from '@/lib/track.server';
import { entitlement } from '@/lib/plans.server';

export const maxDuration = 60;

// Starts a purchase: the price always comes from the database, never from the browser.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  const user = auth.user;

  let body: { designId?: string; currency?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  if (!body.designId) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  const currency = await getCurrency();   // always from where the buyer is, never from the browser

  const { data: design } = await supabase.from('designs').select('id, tool_slug, name').eq('id', body.designId).maybeSingle();
  if (!design) return NextResponse.json({ error: 'Design not found.' }, { status: 404 });

  const db = supabaseAdmin();
  const [{ data: tool }, { data: price }, { data: profile }] = await Promise.all([
    db.from('tools').select('status, name').eq('slug', design.tool_slug).single(),
    db.from('tool_prices').select('amount_minor').eq('tool_slug', design.tool_slug).eq('currency', currency).maybeSingle(),
    db.from('profiles').select('role, full_name').eq('id', user.id).single(),
  ]);
  // a tool that is not live yet can still be tried end to end by the shop owner
  if (!tool || (tool.status !== 'live' && profile?.role !== 'admin')) return NextResponse.json({ error: 'This tool is not available right now.' }, { status: 409 });

  // On a plan with designs left today: no payment, build straight away.
  const ent = await entitlement(user.id, design.tool_slug);
  if (ent?.covers && (ent.remaining == null || ent.remaining > 0)) {
    const { data: po, error: pe } = await db.from('orders').insert({
      user_id: user.id, design_id: design.id, tool_slug: design.tool_slug, currency: ent.sub.currency, amount_minor: 0,
      status: 'paid', provider: 'plan', subscription_id: ent.sub.id, paid_at: new Date().toISOString(),
    }).select('id').single();
    if (pe || !po) return NextResponse.json({ error: 'Could not start the order.' }, { status: 500 });
    await trackServer('plan_build', { name: design.name, userId: user.id, props: { orderId: po.id, plan: ent.plan.id, left: ent.remaining == null ? null : ent.remaining - 1 } });
    try {
      const fileId = await fulfilOrder(po.id);
      return NextResponse.json({ free: true, plan: true, fileId, orderId: po.id, remaining: ent.remaining == null ? null : ent.remaining - 1 });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message, orderId: po.id }, { status: 500 });
    }
  }
  if (!price) return NextResponse.json({ error: `Payments in ${currency} are not set up yet.` }, { status: 409 });

  const isAdmin = profile?.role === 'admin';
  const amount = isAdmin ? 0 : price.amount_minor;
  const { data: order, error } = await db.from('orders').insert({
    user_id: user.id, design_id: design.id, tool_slug: design.tool_slug, currency, amount_minor: amount,
    status: amount === 0 ? 'paid' : 'created', provider: amount === 0 ? (isAdmin ? 'admin' : 'free') : 'razorpay',
    paid_at: amount === 0 ? new Date().toISOString() : null,
  }).select('id').single();
  if (error || !order) return NextResponse.json({ error: 'Could not start the order.' }, { status: 500 });

  await trackServer('checkout', { name: design.name, userId: user.id, props: { orderId: order.id, designId: design.id, amount, currency, tool: design.tool_slug } });

  // Free (or the shop owner): build straight away.
  if (amount === 0) {
    try {
      const fileId = await fulfilOrder(order.id);
      return NextResponse.json({ free: true, fileId, orderId: order.id });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message, orderId: order.id }, { status: 500 });
    }
  }

  try {
    const rzp = await createOrder(amount, currency, order.id.slice(0, 36), { order_id: order.id, design: design.name, tool: design.tool_slug });
    await db.from('orders').update({ provider_order_id: rzp.id }).eq('id', order.id);
    return NextResponse.json({
      keyId: serverEnv('RAZORPAY_KEY_ID'), providerOrderId: rzp.id, orderId: order.id, amount, currency,
      description: `${tool.name} – ${design.name}`, prefill: { name: profile?.full_name ?? '', email: user.email ?? '' },
    });
  } catch (e) {
    await db.from('orders').update({ status: 'failed', error: (e as Error).message.slice(0, 500) }).eq('id', order.id);
    return NextResponse.json({ error: 'The payment could not be started: ' + (e as Error).message }, { status: 502 });
  }
}
