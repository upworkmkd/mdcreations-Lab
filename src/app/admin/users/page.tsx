import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BulkForm, RowDelete, Sel } from '../bulk';
import { hasAccess } from '@/lib/plans.server';
import { Card, Filters, PageHead, Pager, ago, money, num, pageNum, str, when } from '../ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users' };
const SIZE = 50;

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = pageNum(sp.page), q = str(sp.q).trim(), f = str(sp.f);
  const db = supabaseAdmin();
  let query = db.from('profiles').select('id, email, full_name, role, created_at', { count: 'exact' });
  if (q) query = query.or(`email.ilike.%${q.replace(/[%,()]/g, '')}%,full_name.ilike.%${q.replace(/[%,()]/g, '')}%`);
  if (f === 'admin') query = query.eq('role', 'admin');
  if (f === 'buyers') {
    const { data: b } = await db.from('orders').select('user_id').in('status', ['paid', 'fulfilled']).limit(5000);
    query = query.in('id', [...new Set((b ?? []).map((x) => x.user_id))].concat('00000000-0000-0000-0000-000000000000'));
  }
  // who is on a monthly plan right now (and who was once)
  const { data: allSubs } = await db.from('subscriptions').select('user_id, status, current_end').neq('status', 'created').limit(5000);
  const onPlan = new Set((allSubs ?? []).filter((x) => hasAccess(x)).map((x) => x.user_id));
  const everPlan = new Set((allSubs ?? []).map((x) => x.user_id));
  if (f === 'subscribers') query = query.in('id', [...onPlan].concat('00000000-0000-0000-0000-000000000000'));
  if (f === 'past-subscribers') query = query.in('id', [...everPlan].filter((id) => !onPlan.has(id)).concat('00000000-0000-0000-0000-000000000000'));
  // whose email is not confirmed yet (one call lists up to 1,000 accounts)
  const { data: au } = await db.auth.admin.listUsers({ perPage: 1000 });
  const unconfirmed = new Set((au?.users ?? []).filter((x) => !x.email_confirmed_at).map((x) => x.id));
  if (f === 'unconfirmed') query = query.in('id', [...unconfirmed].concat('00000000-0000-0000-0000-000000000000'));
  const { data, count } = await query.order('created_at', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  const ids = (data ?? []).map((u) => u.id);
  const [designs, orders, visitors, downloads, subs, planPays] = ids.length ? await Promise.all([
    db.from('designs').select('user_id').in('user_id', ids),
    db.from('orders').select('user_id, status, amount_minor, currency').in('user_id', ids),
    db.from('visitors').select('user_id, last_seen, city, country, visits').in('user_id', ids),
    db.from('downloads').select('user_id').in('user_id', ids),
    db.from('subscriptions').select('user_id, plan_id, status, current_end, cancel_at_period_end, amount_minor, currency, created_at').in('user_id', ids).neq('status', 'created').order('created_at', { ascending: false }),
    db.from('payments').select('user_id, amount_minor, currency').in('user_id', ids).not('subscription_id', 'is', null).in('status', ['captured', 'authorized']),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  type Plan = { plan_id: string; status: string; current_end: string | null; cancel_at_period_end: boolean; amount_minor: number; currency: string };
  const agg = new Map<string, { designs: number; paid: number; spent: Record<string, number>; plans: Record<string, number>; plan: Plan | null; seen: string | null; place: string | null; visits: number; dl: number }>();
  const g = (id: string) => { if (!agg.has(id)) agg.set(id, { designs: 0, paid: 0, spent: {}, plans: {}, plan: null, seen: null, place: null, visits: 0, dl: 0 }); return agg.get(id)!; };
  // the plan shown is the one giving access now, else the latest one
  for (const x of subs.data ?? []) { const a = g(x.user_id); if (!a.plan || (!hasAccess(a.plan) && hasAccess(x))) a.plan = x; }
  for (const p of planPays.data ?? []) { const a = g(p.user_id); a.plans[p.currency] = (a.plans[p.currency] ?? 0) + p.amount_minor; }
  for (const d of designs.data ?? []) g(d.user_id).designs++;
  for (const o of orders.data ?? []) if (o.status === 'paid' || o.status === 'fulfilled') { const a = g(o.user_id); a.paid++; a.spent[o.currency] = (a.spent[o.currency] ?? 0) + o.amount_minor; }
  for (const v of visitors.data ?? []) { if (!v.user_id) continue; const a = g(v.user_id); a.visits += v.visits; if (!a.seen || v.last_seen > a.seen) { a.seen = v.last_seen; a.place = [v.city, v.country].filter(Boolean).join(', '); } }
  for (const d of downloads.data ?? []) g(d.user_id).dl++;

  return (
    <>
      <PageHead title="Users" sub="Everyone with an account.">
        <form className="adm-search" action="/admin/users">
          <input name="q" defaultValue={q} placeholder="Search name or email" className="input" aria-label="Search users" />
        </form>
      </PageHead>
      <Filters base="/admin/users" current={f} options={[['', 'All'], ['subscribers', `On a plan (${onPlan.size})`], ['past-subscribers', 'Plan ended'], ['buyers', 'Customers who paid'], ['unconfirmed', 'Email not confirmed'], ['admin', 'Admins']]} />
      <Card flush>
        <BulkForm kind="users" noun="user" warn="Their account, designs, orders, files and plans are removed, and any live plan is cancelled in Razorpay.">
<div className="tbl-wrap"><table className="tbl adm-tbl">
          <thead><tr><th className="sel" /><th>User</th><th>Joined</th><th>Last seen</th><th className="num">Visits</th><th className="num">Designs</th><th>Plan</th><th className="num">Orders paid</th><th className="num">Spent</th><th className="num">Downloads</th><th /></tr></thead>
          <tbody>
            {(data ?? []).map((u) => {
              const a = agg.get(u.id);
              return (
                <tr key={u.id}>
                  <td className="sel"><Sel id={u.id} /></td>
                  <td><Link href={`/admin/users/${u.id}`} className="adm-who"><b>{u.full_name || u.email}</b></Link>{u.role === 'admin' && <> <span className="pill">admin</span></>}{unconfirmed.has(u.id) && <> <span className="pill failed" title="Has not confirmed the email yet. Open the user to send the confirmation again.">not confirmed</span></>}<div className="id">{u.email}</div></td>
                  <td title={when(u.created_at)}>{ago(u.created_at)}</td>
                  <td>{a?.seen ? ago(a.seen) : '—'}<div className="id">{a?.place}</div></td>
                  <td className="num">{num(a?.visits)}</td>
                  <td className="num">{num(a?.designs)}</td>
                  <td><PlanCell p={a?.plan ?? null} /></td>
                  <td className="num">{num(a?.paid)}</td>
                  <td className="num"><Spent orders={a?.spent ?? {}} plans={a?.plans ?? {}} /></td>
                  <td className="num">{num(a?.dl)}</td>
                  <td className="act"><RowDelete id={u.id} /></td>
                </tr>
              );
            })}
            {!data?.length && <tr><td colSpan={11} className="muted">No users match.</td></tr>}
          </tbody>
        </table></div>
        </BulkForm>
      </Card>
      <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/users" params={{ q, f }} />
    </>
  );
}

const sum = (m: Record<string, number>) => Object.entries(m).map(([c, n]) => money(n, c)).join(' + ');

/** Total spent, split into one-off orders and plan payments when there are both. */
function Spent({ orders, plans }: { orders: Record<string, number>; plans: Record<string, number> }) {
  const all: Record<string, number> = { ...orders };
  for (const [c, n] of Object.entries(plans)) all[c] = (all[c] ?? 0) + n;
  if (!Object.keys(all).length) return <>—</>;
  const o = Object.keys(orders).length, p = Object.keys(plans).length;
  return <>{sum(all)}{p ? <div className="id">{o ? `${sum(orders)} orders · ` : ''}{sum(plans)} plan</div> : null}</>;
}

function PlanCell({ p }: { p: { plan_id: string; status: string; current_end: string | null; cancel_at_period_end: boolean; amount_minor: number; currency: string } | null }) {
  if (!p) return <span className="muted">—</span>;
  const live = hasAccess(p), problem = p.status === 'pending' || p.status === 'halted';
  const label = problem ? 'payment problem' : live ? (p.cancel_at_period_end || p.status === 'cancelled' ? 'ending' : 'active') : 'ended';
  return (
    <Link href="/admin/subscriptions" title={p.current_end ? `Paid until ${when(p.current_end)}` : undefined}>
      <b style={{ textTransform: 'capitalize' }}>{p.plan_id}</b> <span className={`pill ${problem ? 'failed' : live ? 'live' : ''}`}>{label}</span>
      <div className="id">{money(p.amount_minor, p.currency)}/month{live && p.current_end ? ` · until ${new Date(p.current_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}` : ''}</div>
    </Link>
  );
}
