import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BulkForm, RowDelete, Sel } from '../bulk';
import { toolBySlug } from '@/lib/tools';
import { Card, Filters, PageHead, Pager, Pill, emails, money, one, pageNum, str, when } from '../ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders' };
const SIZE = 50;

export default async function Orders({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = pageNum(sp.page), f = str(sp.f);
  const db = supabaseAdmin();
  let q = db.from('orders').select('id, user_id, tool_slug, currency, amount_minor, status, provider, provider_order_id, error, created_at, paid_at, fulfilled_at, customer_emailed_at, kind, print_status, designs(name, preview)', { count: 'exact' });
  if (['created', 'paid', 'fulfilled', 'failed', 'refunded'].includes(f)) q = q.eq('status', f);
  const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  const who = await emails((data ?? []).map((o) => o.user_id));
  return (
    <>
      <PageHead title="Orders" sub="Fulfilled means the files were built and are in the customer's account. Paid but not fulfilled needs a look." />
      <Filters base="/admin/orders" current={f} options={[['', 'All'], ['fulfilled', 'Fulfilled'], ['paid', 'Paid, not built'], ['created', 'Not paid'], ['failed', 'Failed'], ['refunded', 'Refunded']]} />
      <Card flush>
        <BulkForm kind="orders" noun="order" warn="Their files, payment records and downloads go too. This does not refund anything in Razorpay.">
<div className="tbl-wrap"><table className="tbl adm-tbl">
          <thead><tr><th className="sel" /><th>Created</th><th>Customer</th><th>Design</th><th>Status</th><th className="num">Amount</th><th>Razorpay order</th><th /></tr></thead>
          <tbody>
            {(data ?? []).map((o) => {
              const d = one(o.designs as { name: string; preview: string | null } | { name: string; preview: string | null }[] | null);
              return (
                <tr key={o.id}>
                  <td className="sel"><Sel id={o.id} /></td>
                  <td>{when(o.created_at)}{o.paid_at && <div className="id">paid {when(o.paid_at)}</div>}</td>
                  <td><Link href={`/admin/users/${o.user_id}`}>{who.get(o.user_id)?.email ?? o.user_id.slice(0, 8)}</Link></td>
                  <td><span className="adm-mini">{d?.preview ? <img src={d.preview} alt="" /> : null}<span>{d?.name ?? '—'}<span className="id">{toolBySlug(o.tool_slug)?.name ?? o.tool_slug}</span></span></span></td>
                  <td><Pill s={o.status} />{o.kind === 'print' && <> <Link href={`/admin/print-orders/${o.id}`} className={`pill po-${o.print_status ?? 'to_print'}`}>printed · {(o.print_status ?? 'to print').replace('_', ' ')}</Link></>}{o.provider !== 'razorpay' && <span className="id"> · {o.provider}</span>}{o.customer_emailed_at && <span className="id" title={`Receipt emailed ${when(o.customer_emailed_at)}`}> · ✉ emailed</span>}{o.error && <div className="id" style={{ color: 'var(--bad)' }}>{o.error}</div>}</td>
                  <td className="num">{money(o.amount_minor, o.currency)}</td>
                  <td className="id">{o.provider_order_id ?? '—'}</td>
                  <td className="act"><RowDelete id={o.id} /></td>
                </tr>
              );
            })}
            {!data?.length && <tr><td colSpan={8} className="muted">No orders.</td></tr>}
          </tbody>
        </table></div>
        </BulkForm>
      </Card>
      <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/orders" params={{ f }} />
    </>
  );
}
