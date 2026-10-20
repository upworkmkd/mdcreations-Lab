import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BulkForm, RowDelete, Sel } from '../bulk';
import { Card, PageHead, Pager, Pill, emails, money, pageNum, when } from '../ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payments' };
const SIZE = 50;

export default async function Payments({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = pageNum((await searchParams).page);
  const db = supabaseAdmin();
  const { data, count } = await db.from('payments').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  const who = await emails((data ?? []).map((p) => p.user_id));
  return (
    <>
      <PageHead title="Payments" sub="Captured Razorpay payments. Refunds are made in the Razorpay dashboard." />
      <Card flush>
        <BulkForm kind="payments" noun="payment record" warn="Only our record is removed; nothing changes in Razorpay.">
<div className="tbl-wrap"><table className="tbl adm-tbl">
          <thead><tr><th className="sel" /><th>When</th><th>Customer</th><th>Payment</th><th>Method</th><th>Status</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>
            {(data ?? []).map((p) => (
              <tr key={p.id}>
                <td className="sel"><Sel id={p.id} /></td>
                <td>{when(p.created_at)}</td>
                <td><Link href={`/admin/users/${p.user_id}`}>{who.get(p.user_id)?.email ?? p.user_id.slice(0, 8)}</Link></td>
                <td className="id">{p.provider_payment_id}</td>
                <td>{p.method ?? '—'}</td>
                <td><Pill s={p.status} /></td>
                <td className="num">{money(p.amount_minor, p.currency)}</td>
                <td className="act"><RowDelete id={p.id} /></td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={8} className="muted">No payments yet.</td></tr>}
          </tbody>
        </table></div>
        </BulkForm>
      </Card>
      <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/payments" />
    </>
  );
}
