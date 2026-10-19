import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cancelSubscription } from '@/lib/razorpay.server';
import { currentSubscription, syncSubscription } from '@/lib/plans.server';
import { trackServer } from '@/lib/track.server';

// Stops renewals. The plan keeps working until the end of the month already paid for.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL('/login?next=/account', req.url), 303);
  const sub = await currentSubscription(auth.user.id);
  if (!sub?.provider_subscription_id) return NextResponse.redirect(new URL('/account#plan', req.url), 303);
  try {
    const r = await cancelSubscription(sub.provider_subscription_id, true);
    await syncSubscription(r);
    await supabaseAdmin().from('subscriptions').update({ cancel_at_period_end: true }).eq('id', sub.id);
    await trackServer('subscription_cancel', { name: `${sub.plan_id} plan`, userId: auth.user.id });
  } catch (e) {
    return NextResponse.redirect(new URL(`/account?plan_error=${encodeURIComponent((e as Error).message)}#plan`, req.url), 303);
  }
  return NextResponse.redirect(new URL('/account?plan=cancelled#plan', req.url), 303);
}
