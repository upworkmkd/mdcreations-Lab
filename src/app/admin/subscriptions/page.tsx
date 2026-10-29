import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BulkForm, RowDelete, Sel } from '../bulk';
import { toolBySlug } from '@/lib/tools';
import { hasAccess } from '@/lib/plans.server';
import { FollowUpButton } from '../followup/followup';
import { Card, Filters, PageHead, Pager, Stat, emails, money, num, pageNum, str, when } from '../ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Subscriptions' };
const SIZE = 50;

export default async function Subscriptions({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = pageNum(sp.page), f = str(sp.f);
  const db = supabaseAdmin();
  let q = db.from('subscriptions').select('*', { count: 'exact' });
  if (f === 'active') q = q.in('status', ['active', 'authenticated']);
  else if (f === 'problem') q = q.in('status', ['pending', 'halted']);
  else if (f === 'ended') q = q.in('status', ['cancelled', 'completed', 'expired']);
  else if (f === 'created') q = q.eq('status', 'created');
  const [{ data, count, error }, all] = await Promise.all([
    q.order('created_at', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1),
    db.from('subscriptions').select('status, current_end, currency, amount_minor, cancel_at_period_end'),
  ]);
  const who = await emails((data ?? []).map((s) => s.user_id));
  const live = (all.data ?? []).filter((s) => hasAccess(s));
  const mrr: Record<string, number> = {};
  for (const s of live) if (!s.cancel_at_period_end && s.status !== 'cancelled') mrr[s.currency] = (mrr[s.currency] ?? 0) + s.amount_minor;
  const ids = (data ?? []).map((s) => s.id);
  const { data: builds } = ids.length ? await db.from('orders').select('subscription_id').in('subscription_id', ids) : { data: [] };
  const startedOnly = (data ?? []).filter((s) => s.status === 'created').map((s) => s.id);
  const { data: fu } = startedOnly.length ? await db.from('email_log').select('subscription_id').eq('kind', 'followup_subscription').in('subscription_id', startedOnly) : { data: [] };
  const fuCount = new Map<string, number>();
  for (const r of fu ?? []) if (r.subscription_id) fuCount.set(r.subscription_id, (fuCount.get(r.subscription_id) ?? 0) + 1);
  const used = new Map<string, number>();
  for (const b of builds ?? []) used.set(b.subscription_id!, (used.get(b.subscription_id!) ?? 0) + 1);

  return (
    <>
      <PageHead title="Subscriptions" sub="Everyone on a monthly plan. Status comes from Razorpay webhooks." />
      <div className="adm-stats">
        <Stat label="Active plans" value={num(live.length)} />
        <Stat label="Monthly revenue" value={Object.keys(mrr).length ? Object.entries(mrr).map(([c, n]) => money(n, c)).join(' + ') : '₹0'} note="renewing plans" />
        <Stat label="Ending" value={num(live.filter((s) => s.cancel_at_period_end || s.status === 'cancelled').length)} note="cancelled, still in their month" />
        <Stat label="Payment problems" value={num((all.data ?? []).filter((s) => s.status === 'pending' || s.status === 'halted').length)} />
      </div>
      <Filters base="/admin/subscriptions" current={f} options={[['', 'All'], ['active', 'Active'], ['problem', 'Payment problems'], ['ended', 'Ended'], ['created', 'Started, not paid']]} />
      {error && <div className="adm-alert">{error.message}. Run the subscriptions SQL migration.</div>}
      <Card flush>
        <BulkForm kind="subscriptions" noun="subscription" warn="Live plans are cancelled in Razorpay straight away.">
<div className="tbl-wrap"><table className="tbl adm-tbl">
          <thead><tr><th className="sel" /><th>Started</th><th>Customer</th><th>Plan</th><th>Status</th><th>Paid until</th><th className="num">Months paid</th><th className="num">Designs built</th><th className="num">Price</th><th /></tr></thead>
          <tbody>
            {(data ?? []).map((s) => (
              <tr key={s.id}>
                <td className="sel"><Sel id={s.id} /></td>
                <td>{when(s.created_at)}<div className="id">{s.provider_subscription_id ?? '—'}</div></td>
                <td><Link href={`/admin/users/${s.user_id}`}>{who.get(s.user_id)?.email ?? s.user_id.slice(0, 8)}</Link></td>
                <td><b>{s.plan_id}</b><div className="id">{s.tool_slug ? toolBySlug(s.tool_slug)?.name ?? s.tool_slug : 'every tool'}</div></td>
                <td><span className={`pill ${['active', 'authenticated'].includes(s.status) ? 'live' : ['halted', 'pending'].includes(s.status) ? 'failed' : ''}`}>{s.status}</span>{s.cancel_at_period_end && <div className="id">won&apos;t renew</div>}</td>
                <td>{when(s.current_end)}</td>
                <td className="num">{s.paid_count}</td>
                <td className="num">{used.get(s.id) ?? 0}</td>
                <td className="num">{money(s.amount_minor, s.currency)}</td>
                <td className="act"><span className="adm-inline" style={{ flexWrap: 'nowrap' }}>{s.status === 'created' && <FollowUpButton kind="subscription" id={s.id} sent={fuCount.get(s.id) ?? 0} />}<RowDelete id={s.id} /></span></td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={10} className="muted">No subscriptions yet.</td></tr>}
          </tbody>
        </table></div>
        </BulkForm>
      </Card>
      <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/subscriptions" params={{ f }} />
    </>
  );
}
