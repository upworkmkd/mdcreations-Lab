import { itemOf } from '@/lib/stl/product';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/consent';
import { TOOLS } from '@/lib/tools';
import { emailHistory } from '@/lib/followup.server';
import { Card, PageHead, Pill, emails, money, when } from '../../ui';
import { FollowUpButton } from '../../followup/followup';
import { EmailHistory } from '../../followup/history';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order' };

/** One order: what was bought, by whom, how it was paid, the files, and every email about it. */
export default async function Order({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = supabaseAdmin();
  const { data: o } = await db.from('orders').select('id, user_id, tool_slug, currency, amount_minor, status, provider, provider_order_id, kind, error, created_at, paid_at, fulfilled_at, product_id, designs(name, preview), stl_products(title, slug, images)').eq('id', id).maybeSingle();
  if (!o) notFound();
  if (o.kind === 'print') redirect(`/admin/print-orders/${o.id}`);
  const [who, { data: pay }, { data: file }, history] = await Promise.all([
    emails([o.user_id]),
    db.from('payments').select('provider_payment_id, method, status').eq('order_id', o.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('files').select('id, name, size_bytes').eq('order_id', o.id).maybeSingle(),
    emailHistory({ orderId: o.id }),
  ]);
  const c = who.get(o.user_id);
  const d = itemOf(o);
  const unpaid = o.status === 'created' || o.status === 'failed';
  return (
    <>
      <PageHead title={`Order #${o.id.slice(0, 8).toUpperCase()}`} sub={<><Link href="/admin/orders">← Orders</Link> · {d.product ? 'STL files' : TOOLS.find((t) => t.slug === o.tool_slug)?.name ?? o.tool_slug} · {when(o.created_at)}</>}>
        <Pill s={o.status} />
        {unpaid && <FollowUpButton kind="order" id={o.id} sent={history.filter((h) => h.kind === 'followup_order').length} />}
        {o.status === 'fulfilled' && <FollowUpButton kind="review" id={o.id} sent={history.some((h) => h.kind === 'review_request') ? 1 : 0} />}
      </PageHead>
      <div className="adm-grid2 wide">
        <div className="adm-col">
          <Card title="Design">
            <div className="adm-po-what">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.preview ? <img src={d.preview} alt="" /> : <div className="ph" />}
              <div>
                <p className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>{d.name ?? 'Design'}</p>
                <p className="muted">{file ? `Files built: ${file.name}` : unpaid ? 'Not paid, so no files were built.' : 'Files not built yet.'}</p>
                {o.error && <p className="msg err" style={{ marginTop: 10 }}>{o.error}</p>}
              </div>
            </div>
          </Card>
          <Card title="Emails about this order"><EmailHistory rows={history} /></Card>
        </div>
        <div className="adm-col">
          <Card title="Customer">
            <dl className="adm-facts">
              <div><dt>Account</dt><dd><Link href={`/admin/users/${o.user_id}`}>{c?.name || c?.email || 'Open'}</Link></dd></div>
              <div><dt>Email</dt><dd>{c?.email ?? '—'}</dd></div>
            </dl>
          </Card>
          <Card title="Payment">
            <dl className="adm-facts">
              <div><dt>Amount</dt><dd>{money(o.amount_minor, o.currency)}{o.provider !== 'razorpay' ? ` · ${o.provider}` : ''}</dd></div>
              <div><dt>Paid</dt><dd>{o.paid_at ? when(o.paid_at) : 'Not paid'}{pay?.method ? ` · ${pay.method}` : ''}</dd></div>
              {pay?.provider_payment_id && <div><dt>Payment</dt><dd><code>{pay.provider_payment_id}</code></dd></div>}
              {o.provider_order_id && <div><dt>Razorpay order</dt><dd><code>{o.provider_order_id}</code></dd></div>}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
