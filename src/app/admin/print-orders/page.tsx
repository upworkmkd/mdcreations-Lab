import { itemOf } from '@/lib/stl/product';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TOOLS } from '@/lib/tools';
import { PRINT_STATUS, type ShipTo } from '@/lib/ship';
import { Card, Empty, Filters, PageHead, Pager, Stat, ago, emails, money, num, pageNum, str, when } from '../ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Print orders' };
const SIZE = 30;

/** Printed orders: what to print, what is on the printer, what has gone out. */
export default async function PrintOrders({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = pageNum(sp.page), f = str(sp.f) || 'open';
  const db = supabaseAdmin();
  // only paid ones: an unpaid printed order is someone who closed the payment window
  let q = db.from('orders').select('id, user_id, tool_slug, currency, amount_minor, provider, ship_to, print_status, print_file, error, created_at, paid_at, shipped_at, product_id, designs(name, preview), stl_products(title, images)', { count: 'exact' })
    .eq('kind', 'print').in('status', ['paid', 'fulfilled']);
  if (f === 'open') q = q.in('print_status', ['to_print', 'printing']);
  else if (f !== 'all') q = q.eq('print_status', f);
  const [{ data, count, error }, all] = await Promise.all([
    q.order('created_at', { ascending: f === 'open' }).range((page - 1) * SIZE, page * SIZE - 1),
    db.from('orders').select('print_status').eq('kind', 'print').in('status', ['paid', 'fulfilled']).limit(5000),
  ]);
  const n = (s: string) => (all.data ?? []).filter((o) => o.print_status === s).length;
  const who = await emails((data ?? []).map((o) => o.user_id));
  return (
    <>
      <PageHead title="Print orders" sub="Designs customers paid to have printed and posted. Download the files, print, assemble, post, and move each order along; the customer is emailed when it ships." />
      <div className="adm-stats">
        <Stat label="To print" value={num(n('to_print'))} href="/admin/print-orders?f=to_print" />
        <Stat label="Printing" value={num(n('printing'))} href="/admin/print-orders?f=printing" />
        <Stat label="Shipped" value={num(n('shipped'))} href="/admin/print-orders?f=shipped" />
        <Stat label="Delivered" value={num(n('delivered'))} href="/admin/print-orders?f=delivered" />
      </div>
      <Filters base="/admin/print-orders" current={f === 'open' ? '' : f} options={[['', 'To do'], ['to_print', 'To print'], ['printing', 'Printing'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['all', 'All']]} />
      <Card flush>
        {error ? <Empty>Could not read print orders: {error.message}. Did you run the printed orders SQL migration?</Empty>
          : !data?.length ? <Empty>{f === 'open' ? 'Nothing to print right now.' : 'No orders here.'}</Empty> : (
          <div className="tbl-wrap"><table className="tbl adm-tbl">
            <thead><tr><th>Ordered</th><th>Design</th><th>Customer</th><th>Ship to</th><th>Status</th><th className="num">Paid</th><th /></tr></thead>
            <tbody>
              {data.map((o) => {
                const d = itemOf(o);
                const s = (o.ship_to ?? {}) as Partial<ShipTo>;
                const c = who.get(o.user_id);
                return (
                  <tr key={o.id}>
                    <td title={when(o.paid_at ?? o.created_at)}>{ago(o.paid_at ?? o.created_at)}</td>
                    <td>
                      <Link href={`/admin/print-orders/${o.id}`} className="adm-po-design">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {d.preview ? <img src={d.preview} alt="" /> : <span className="ph" />}
                        <span><b>{d.name ?? 'Design'}</b><span className="id">{d.product ? 'STL shop' : TOOLS.find((t) => t.slug === o.tool_slug)?.name ?? o.tool_slug} · #{o.id.slice(0, 8).toUpperCase()}</span></span>
                      </Link>
                    </td>
                    <td>{s.name ?? c?.name ?? '—'}<div className="id">{c?.email}</div></td>
                    <td>{[s.city, s.state].filter(Boolean).join(', ')}<div className="id">{s.pin}</div></td>
                    <td><span className={`pill po-${o.print_status}`}>{PRINT_STATUS[o.print_status ?? 'to_print']?.label ?? o.print_status}</span>
                      {!o.print_file && <div className="id" style={{ color: 'var(--bad)' }}>Files not built</div>}</td>
                    <td className="num">{o.provider === 'admin' ? <span className="id">test</span> : money(o.amount_minor, o.currency)}</td>
                    <td><Link className="btn small ghost" href={`/admin/print-orders/${o.id}`}>Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>
      <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/print-orders" params={{ f: f === 'open' ? undefined : f }} />
    </>
  );
}
