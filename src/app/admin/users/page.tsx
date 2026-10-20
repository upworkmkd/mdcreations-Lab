import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BulkForm, RowDelete, Sel } from '../bulk';
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
  const { data, count } = await query.order('created_at', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  const ids = (data ?? []).map((u) => u.id);
  const [designs, orders, visitors, downloads] = ids.length ? await Promise.all([
    db.from('designs').select('user_id').in('user_id', ids),
    db.from('orders').select('user_id, status, amount_minor, currency').in('user_id', ids),
    db.from('visitors').select('user_id, last_seen, city, country, visits').in('user_id', ids),
    db.from('downloads').select('user_id').in('user_id', ids),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const agg = new Map<string, { designs: number; paid: number; spent: Record<string, number>; seen: string | null; place: string | null; visits: number; dl: number }>();
  const g = (id: string) => { if (!agg.has(id)) agg.set(id, { designs: 0, paid: 0, spent: {}, seen: null, place: null, visits: 0, dl: 0 }); return agg.get(id)!; };
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
      <Filters base="/admin/users" current={f} options={[['', 'All'], ['buyers', 'Customers who paid'], ['admin', 'Admins']]} />
      <Card flush>
        <BulkForm kind="users" noun="user" warn="Their account, designs, orders, files and plans are removed, and any live plan is cancelled in Razorpay.">
<div className="tbl-wrap"><table className="tbl adm-tbl">
          <thead><tr><th className="sel" /><th>User</th><th>Joined</th><th>Last seen</th><th className="num">Visits</th><th className="num">Designs</th><th className="num">Orders paid</th><th className="num">Spent</th><th className="num">Downloads</th><th /></tr></thead>
          <tbody>
            {(data ?? []).map((u) => {
              const a = agg.get(u.id);
              return (
                <tr key={u.id}>
                  <td className="sel"><Sel id={u.id} /></td>
                  <td><Link href={`/admin/users/${u.id}`} className="adm-who"><b>{u.full_name || u.email}</b></Link>{u.role === 'admin' && <> <span className="pill">admin</span></>}<div className="id">{u.email}</div></td>
                  <td title={when(u.created_at)}>{ago(u.created_at)}</td>
                  <td>{a?.seen ? ago(a.seen) : '—'}<div className="id">{a?.place}</div></td>
                  <td className="num">{num(a?.visits)}</td>
                  <td className="num">{num(a?.designs)}</td>
                  <td className="num">{num(a?.paid)}</td>
                  <td className="num">{a && Object.keys(a.spent).length ? Object.entries(a.spent).map(([c, n]) => money(n, c)).join(' + ') : '—'}</td>
                  <td className="num">{num(a?.dl)}</td>
                  <td className="act"><RowDelete id={u.id} /></td>
                </tr>
              );
            })}
            {!data?.length && <tr><td colSpan={10} className="muted">No users match.</td></tr>}
          </tbody>
        </table></div>
        </BulkForm>
      </Card>
      <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/users" params={{ q, f }} />
    </>
  );
}
