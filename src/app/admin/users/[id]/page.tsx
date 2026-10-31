import { itemOf } from '@/lib/stl/product';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/consent';
import { toolBySlug } from '@/lib/tools';
import { Card, Empty, Filters, PageHead, Pager, Pill, Stat, ago, money, num, one, pageNum, place, str, when } from '../../ui';
import { NOISE, Timeline, type Ev, type Sess } from '../../timeline';
import { BulkForm, DeleteOne } from '../../bulk';
import { setTracking } from '../../actions';
import { hasAccess } from '@/lib/plans.server';
import { emailHistory } from '@/lib/followup.server';
import { EmailHistory } from '../../followup/history';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'User' };
const SIZE = 300;

export default async function User({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await searchParams;
  const page = pageNum(sp.page), f = str(sp.f);
  const db = supabaseAdmin();
  const { data: u } = await db.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!u) notFound();
  let evq = db.from('visitor_events').select('*', { count: 'exact' }).eq('user_id', id);
  if (f === 'key') evq = evq.not('type', 'in', `(${NOISE.join(',')})`);
  const [auth, visitors, designs, orders, payments, files, downloads, ev, subs] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.from('visitors').select('*').eq('user_id', id).order('last_seen', { ascending: false }),
    db.from('designs').select('id, name, preview, tool_slug, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(60),
    db.from('orders').select('id, tool_slug, currency, amount_minor, status, provider, provider_order_id, created_at, paid_at, error, designs(name), stl_products(title)').eq('user_id', id).order('created_at', { ascending: false }),
    db.from('payments').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    db.from('files').select('id, name, size_bytes, created_at').eq('user_id', id).order('created_at', { ascending: false }),
    db.from('downloads').select('id, file_id, created_at, files(name)').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    evq.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1),
    db.from('subscriptions').select('*').eq('user_id', id).order('created_at', { ascending: false }),
  ]);
  const au = auth.data?.user;
  const mails = await emailHistory({ userId: id, email: u.email, limit: 100 });
  const sids = [...new Set((ev.data ?? []).map((e) => e.session_id).filter(Boolean))] as string[];
  const { data: sess } = sids.length ? await db.from('visitor_sessions').select('*').in('id', sids) : { data: [] };
  const spent: Record<string, number> = {};
  for (const o of orders.data ?? []) if (o.status === 'paid' || o.status === 'fulfilled') spent[o.currency] = (spent[o.currency] ?? 0) + o.amount_minor;
  const vs = visitors.data ?? [];
  const firstVisit = vs.reduce<string | null>((a, v) => (!a || v.first_seen < a ? v.first_seen : a), null);

  return (
    <>
      <PageHead title={u.full_name || u.email} sub={<>{u.email} · joined {when(u.created_at)}{u.role === 'admin' ? ' · admin' : ''}</>}>
        <Link href="/admin/users" className="btn small ghost">← All users</Link>
        <form action={setTracking}>
          <input type="hidden" name="id" value={u.id} /><input type="hidden" name="on" value={u.track === false ? '1' : '0'} />
          <button className="btn small ghost" title={u.track === false ? 'Start recording this account again' : 'Stop recording this account and remove what was recorded'}>{u.track === false ? 'Tracking off · turn on' : 'Stop tracking'}</button>
        </form>
        <DeleteOne kind="users" id={u.id} label="Delete user" after="/admin/users" warn="Deletes the account, designs, orders, files and plans, and cancels any live plan in Razorpay." />
      </PageHead>

      <div className="adm-stats">
        <Stat label="First visit" value={firstVisit ? ago(firstVisit) : '—'} note={firstVisit ? when(firstVisit) : 'no tracked visits'} />
        <Stat label="Last sign-in" value={au?.last_sign_in_at ? ago(au.last_sign_in_at) : '—'} note={au?.email_confirmed_at ? 'email confirmed' : 'email not confirmed'} />
        <Stat label="Visits" value={num(vs.reduce((a, v) => a + v.visits, 0))} note={`${vs.length} browser${vs.length === 1 ? '' : 's'}`} />
        <Stat label="Designs" value={num(designs.data?.length)} />
        <Stat label="Spent" value={Object.keys(spent).length ? Object.entries(spent).map(([c, n]) => money(n, c)).join(' + ') : '—'} note={`${(orders.data ?? []).filter((o) => o.status === 'paid' || o.status === 'fulfilled').length} paid orders`} />
        <Stat label="Downloads" value={num(downloads.data?.length)} />
        <Stat label="Plan" value={(() => { const s = (subs.data ?? []).find((x) => hasAccess(x)); return s ? s.plan_id : 'none'; })()} note={(() => { const s = (subs.data ?? []).find((x) => hasAccess(x)); return s ? `${s.status} · until ${when(s.current_end)}` : `${(subs.data ?? []).length} past`; })()} href="/admin/subscriptions" />
      </div>

      <div className="adm-grid2">
        <Card title="Browsers and devices" flush>
          <div className="tbl-wrap"><table className="tbl adm-tbl">
            <thead><tr><th>Device</th><th>Place · IP</th><th className="num">Visits</th><th>Last seen</th></tr></thead>
            <tbody>
              {vs.map((v) => (
                <tr key={v.id}>
                  <td><Link href={`/admin/visitors/${v.id}`}>{[v.device_type, v.device_model].filter(Boolean).join(' ') || 'Browser'}</Link><div className="id">{[v.browser, v.os].filter(Boolean).join(' · ')}</div></td>
                  <td>{place(v)}<div className="id">{v.ip}</div></td>
                  <td className="num">{v.visits}</td>
                  <td>{ago(v.last_seen)}</td>
                </tr>
              ))}
              {!vs.length && <tr><td colSpan={4} className="muted">No tracked browsers (they may have chosen essential cookies only).</td></tr>}
            </tbody>
          </table></div>
        </Card>
        <Card title="Account">
          <dl className="adm-facts">
            <div><dt>User id</dt><dd><code>{u.id}</code></dd></div>
            <div><dt>Email</dt><dd>{u.email}</dd></div>
            <div><dt>Name</dt><dd>{u.full_name || '—'}</dd></div>
            <div><dt>Role</dt><dd>{u.role}</dd></div>
            <div><dt>Signed up</dt><dd>{when(u.created_at)}</dd></div>
            <div><dt>Email confirmed</dt><dd>{when(au?.email_confirmed_at)}</dd></div>
            <div><dt>Last sign-in</dt><dd>{when(au?.last_sign_in_at)}</dd></div>
            <div><dt>Sign-in method</dt><dd>{au?.app_metadata?.provider ?? '—'}</dd></div>
          </dl>
        </Card>
      </div>

      <Card title="Designs">
        {designs.data?.length ? (
          <div className="adm-designs">
            {designs.data.map((d) => (
              <figure key={d.id}>{d.preview ? <img src={d.preview} alt="" /> : <div className="ph" />}<figcaption><b>{d.name}</b><span>{toolBySlug(d.tool_slug)?.name ?? d.tool_slug} · {ago(d.created_at)}</span></figcaption></figure>
            ))}
          </div>
        ) : <Empty>No designs saved.</Empty>}
      </Card>

      <div className="adm-grid2">
        <Card title="Orders" flush>
          <div className="tbl-wrap"><table className="tbl adm-tbl">
            <thead><tr><th>When</th><th>Design</th><th>Status</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {(orders.data ?? []).map((o) => (
                <tr key={o.id}>
                  <td>{when(o.created_at)}<div className="id">{o.provider_order_id ?? o.provider}</div></td>
                  <td>{itemOf(o).name ?? '—'}</td>
                  <td><Pill s={o.status} />{o.error && <div className="id" style={{ color: 'var(--bad)' }}>{o.error}</div>}</td>
                  <td className="num">{money(o.amount_minor, o.currency)}</td>
                </tr>
              ))}
              {!orders.data?.length && <tr><td colSpan={4} className="muted">No orders.</td></tr>}
            </tbody>
          </table></div>
        </Card>
        <Card title="Payments and downloads" flush>
          <div className="tbl-wrap"><table className="tbl adm-tbl">
            <thead><tr><th>When</th><th>What</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {[
                ...(payments.data ?? []).map((p) => ({ t: p.created_at, k: `p${p.id}`, what: <>Payment <span className="id">{p.provider_payment_id} · {p.method ?? ''}</span> <Pill s={p.status} /></>, amt: money(p.amount_minor, p.currency) })),
                ...(downloads.data ?? []).map((d) => ({ t: d.created_at, k: `d${d.id}`, what: <>Downloaded <b>{one(d.files as { name: string } | { name: string }[] | null)?.name ?? 'file'}</b></>, amt: '' })),
              ].sort((a, b) => (a.t < b.t ? 1 : -1)).map((r) => <tr key={r.k}><td>{when(r.t)}</td><td>{r.what}</td><td className="num">{r.amt}</td></tr>)}
              {!payments.data?.length && !downloads.data?.length && <tr><td colSpan={3} className="muted">Nothing yet. {files.data?.length ? `${files.data.length} files built.` : ''}</td></tr>}
            </tbody>
          </table></div>
        </Card>
      </div>

      <Card title={`Emails to this customer (${mails.length})`}>
        <p className="id" style={{ marginBottom: 10 }}>Receipts, order updates and follow-ups, newest first, each with the order it was about.</p>
        <EmailHistory rows={mails} />
      </Card>

      <Card title="Activity timeline" action={<Filters base={`/admin/users/${id}`} current={f} options={[['', 'Everything'], ['key', 'Pages and key actions']]} />}>
        {u.track === false && <p className="adm-alert" style={{ marginBottom: 14 }}>Tracking is off for this account: nothing it does is recorded.</p>}
        <BulkForm kind="events" noun="event"><Timeline events={(ev.data ?? []) as Ev[]} sessions={(sess ?? []) as Sess[]} selectable /></BulkForm>
        <Pager page={page} size={SIZE} total={ev.count ?? 0} base={`/admin/users/${id}`} params={{ f }} />
      </Card>
    </>
  );
}
