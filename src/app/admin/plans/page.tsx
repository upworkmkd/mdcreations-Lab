import { supabaseAdmin } from '@/lib/supabase/admin';
import { Card, PageHead } from '../ui';
import { PlanRow } from './plan-row';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plans' };

export default async function Plans() {
  const db = supabaseAdmin();
  const [plans, prices] = await Promise.all([db.from('plans').select('*').order('sort'), db.from('plan_prices').select('*')]);
  const pr = (id: string, c: string) => prices.data?.find((p) => p.plan_id === id && p.currency === c);
  return (
    <>
      <PageHead title="Plans" sub="Monthly plans paid with Razorpay Subscriptions. Saving an open plan creates its Razorpay plan for each currency. Changing a price makes a new Razorpay plan: new subscribers pay the new price and current ones keep theirs." />
      {plans.error && <div className="adm-alert">{plans.error.message}. Run <code>supabase/migrations/20261020000000_subscriptions.sql</code> in the Supabase SQL editor.</div>}
      <Card flush>
        <div className="tbl-wrap"><table className="tbl adm-tbl">
          <thead><tr><th>Plan</th><th>Sign-up</th><th>Daily limit</th><th>Price ₹</th><th>Price $</th><th /></tr></thead>
          <tbody>
            {(plans.data ?? []).map((p) => (
              <PlanRow key={p.id} id={p.id} name={p.name} status={p.status} limit={p.daily_limit} tools={p.tools}
                inr={pr(p.id, 'INR')?.amount_minor ?? null} usd={pr(p.id, 'USD')?.amount_minor ?? null}
                rzp={{ INR: pr(p.id, 'INR')?.razorpay_plan_id, USD: pr(p.id, 'USD')?.razorpay_plan_id }} />
            ))}
          </tbody>
        </table></div>
      </Card>
      <Card title="Before the first subscriber">
        <ol className="adm-steps">
          <li>In the Razorpay dashboard, make sure <b>Subscriptions</b> is enabled for your account (Settings → Products, or ask Razorpay support). For dollar plans, <b>international payments</b> must be on too.</li>
          <li>Under Webhooks, add these events to the webhook you already have: subscription.authenticated, subscription.activated, subscription.charged, subscription.pending, subscription.halted, subscription.cancelled, subscription.completed, subscription.paused, subscription.resumed.</li>
          <li>Press Save on each open plan here. A <code>plan_…</code> id under each price means it is ready.</li>
        </ol>
      </Card>
    </>
  );
}
