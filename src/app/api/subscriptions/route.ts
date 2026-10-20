import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createPlan, createSubscription } from '@/lib/razorpay.server';
import { currentSubscription } from '@/lib/plans.server';
import { isCurrency } from '@/lib/money';
import { serverEnv } from '@/lib/env';
import { trackServer } from '@/lib/track.server';

// Starts a monthly plan. The browser then opens Razorpay Checkout with the subscription id to approve the mandate and pay the first month.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  const user = auth.user;

  let body: { plan?: string; currency?: string; tool?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  if (!body.plan || !isCurrency(body.currency)) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const db = supabaseAdmin();
  const [{ data: plan }, { data: price }, { data: profile }] = await Promise.all([
    db.from('plans').select('*').eq('id', body.plan).maybeSingle(),
    db.from('plan_prices').select('*').eq('plan_id', body.plan).eq('currency', body.currency).maybeSingle(),
    db.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ]);
  if (!plan || plan.status !== 'live') return NextResponse.json({ error: 'This plan is not open for sign-up. Please contact us.' }, { status: 409 });
  if (!price) return NextResponse.json({ error: `This plan cannot be paid in ${body.currency} yet. Switch the currency at the top of the page or contact us.` }, { status: 409 });
  // A new or changed price has no Razorpay plan yet: make it now (Razorpay plans cannot change price).
  if (!price.razorpay_plan_id) {
    try {
      price.razorpay_plan_id = (await createPlan(price.amount_minor, body.currency, `${plan.name} plan`, `MD Creations Labs ${plan.name} plan, monthly`)).id;
      await db.from('plan_prices').update({ razorpay_plan_id: price.razorpay_plan_id, updated_at: new Date().toISOString() }).eq('plan_id', plan.id).eq('currency', body.currency);
    } catch (e) {
      return NextResponse.json({ error: 'The plan could not be set up with Razorpay: ' + (e as Error).message }, { status: 502 });
    }
  }

  let tool: string | null = null;
  if (plan.tools === 1) {
    const { data: t } = await db.from('tools').select('slug, status').eq('slug', body.tool ?? '').maybeSingle();
    if (!t || t.status !== 'live') return NextResponse.json({ error: 'Please choose a tool that is live.' }, { status: 400 });
    tool = t.slug;
  }
  if (await currentSubscription(user.id)) return NextResponse.json({ error: 'You already have a plan. You can manage it in your account.' }, { status: 409 });

  const { data: row, error } = await db.from('subscriptions').insert({
    user_id: user.id, plan_id: plan.id, tool_slug: tool, currency: body.currency, amount_minor: price.amount_minor,
    provider_plan_id: price.razorpay_plan_id, status: 'created',
  }).select('id').single();
  if (error || !row) return NextResponse.json({ error: 'Could not start the plan.' }, { status: 500 });

  try {
    const sub = await createSubscription(price.razorpay_plan_id, { subscription: row.id, user: user.id, plan: plan.id, tool: tool ?? 'all' });
    await db.from('subscriptions').update({ provider_subscription_id: sub.id, short_url: sub.short_url ?? null }).eq('id', row.id);
    await trackServer('subscribe_start', { name: `${plan.name} plan`, userId: user.id, props: { plan: plan.id, tool, currency: body.currency, amount: price.amount_minor } });
    return NextResponse.json({
      keyId: serverEnv('RAZORPAY_KEY_ID'), subscriptionId: sub.id, id: row.id,
      description: `${plan.name} plan${tool ? ' – Shadow Lamp Maker' : ''} (monthly)`,
      prefill: { name: profile?.full_name ?? '', email: user.email ?? '' },
    });
  } catch (e) {
    await db.from('subscriptions').update({ status: 'expired' }).eq('id', row.id);
    return NextResponse.json({ error: 'The plan could not be started: ' + (e as Error).message }, { status: 502 });
  }
}
