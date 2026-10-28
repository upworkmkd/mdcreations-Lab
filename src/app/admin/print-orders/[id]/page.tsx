import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/consent';
import { TOOLS } from '@/lib/tools';
import { PRINT_STATUS, type ShipTo } from '@/lib/ship';
import { Card, PageHead, emails, money, one, when } from '../../ui';
import { AddressCard, NoteForm, RebuildButton, StatusControl, TrackingForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Print order' };

const METHOD: Record<string, string> = { card: 'Card', upi: 'UPI', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay later' };

export default async function PrintOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = supabaseAdmin();
  const { data: o } = await db.from('orders')
    .select('id, user_id, tool_slug, currency, amount_minor, status, provider, provider_order_id, ship_to, print_status, print_file, courier, tracking_no, shop_note, error, created_at, paid_at, printing_at, shipped_at, delivered_at, shipped_emailed_at, designs(name, preview, params)')
    .eq('id', id).eq('kind', 'print').maybeSingle();
  if (!o) notFound();
  const [who, { data: pay }] = await Promise.all([
    emails([o.user_id]),
    db.from('payments').select('provider_payment_id, method, status').eq('order_id', o.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const d = one(o.designs as { name: string; preview: string | null; params: unknown } | { name: string; preview: string | null; params: unknown }[] | null);
  const c = who.get(o.user_id);
  const status = o.print_status ?? 'to_print';
  const unpaid = o.status !== 'paid' && o.status !== 'fulfilled';
  const tool = TOOLS.find((t) => t.slug === o.tool_slug)?.name ?? o.tool_slug;
  const timeline: [string, string | null][] = [['Ordered and paid', o.paid_at ?? o.created_at], ['Printing', o.printing_at], ['Shipped', o.shipped_at], ['Delivered', o.delivered_at]];

  return (
    <>
      <PageHead title={`Print order #${o.id.slice(0, 8).toUpperCase()}`} sub={<><Link href="/admin/print-orders">← Print orders</Link> · {tool} · {when(o.paid_at ?? o.created_at)}</>}>
        <span className={`pill po-${status}`} style={{ fontSize: 12, padding: '7px 12px' }}>{PRINT_STATUS[status]?.label ?? status}</span>
      </PageHead>
      {unpaid && <p className="msg err">This order has not been paid ({o.status}). Do not print it.</p>}

      <div className="adm-grid2 wide">
        <div className="adm-col">
          <Card title="What to print">
            <div className="adm-po-what">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d?.preview ? <img src={d.preview} alt={`Preview of ${d?.name ?? 'the design'}`} /> : <div className="ph" />}
              <div>
                <p className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>{d?.name ?? 'Design'}</p>
                <p className="muted">{tool}</p>
                {o.print_file ? (
                  <a className="btn" href={`/api/admin/print-orders/${o.id}/files`} style={{ marginTop: 14 }}>Download the files <span className="arrow">↓</span></a>
                ) : <p className="msg err" style={{ marginTop: 12 }}>The files are not built yet{o.error ? `: ${o.error}` : '.'}</p>}
                {o.print_file && <p className="id" style={{ marginTop: 8 }}>{o.print_file.split('/').pop()} · STL files, README with print settings</p>}
                {!o.print_file && !unpaid && <div style={{ marginTop: 10 }}><RebuildButton id={o.id} /></div>}
              </div>
            </div>
          </Card>
          <Card title="Next step">
            {unpaid ? <p className="muted">Waiting for payment.</p> : <StatusControl id={o.id} status={status} />}
            {(status === 'shipped' || status === 'delivered') && (
              <div style={{ marginTop: 16 }}>
                <p className="adm-po-h">Shipping details</p>
                <TrackingForm id={o.id} courier={o.courier ?? 'India Post'} tracking={o.tracking_no ?? ''} />
                <p className="id" style={{ marginTop: 6 }}>{o.shipped_emailed_at ? `Customer emailed ${when(o.shipped_emailed_at)}.` : 'The customer was not emailed about shipping.'} Saving here does not email again.</p>
              </div>
            )}
          </Card>
          <Card title="Shop note"><NoteForm id={o.id} note={o.shop_note ?? ''} /></Card>
        </div>

        <div className="adm-col">
          <Card title="Ship to">{o.ship_to ? <AddressCard id={o.id} ship={o.ship_to as ShipTo} /> : <p className="muted">No address.</p>}</Card>
          <Card title="Customer">
            <dl className="adm-facts">
              <div><dt>Account</dt><dd><Link href={`/admin/users/${o.user_id}`}>{c?.name || c?.email || 'Open'}</Link></dd></div>
              <div><dt>Email</dt><dd>{c?.email ? <a href={`mailto:${c.email}?subject=${encodeURIComponent(`Your MD Creations order #${o.id.slice(0, 8).toUpperCase()}`)}`}>{c.email}</a> : '—'}</dd></div>
              <div><dt>Paid</dt><dd>{o.provider === 'admin' ? 'Admin test (not charged)' : money(o.amount_minor, o.currency)}{pay?.method ? ` · ${METHOD[pay.method] ?? pay.method}` : ''}</dd></div>
              {pay?.provider_payment_id && <div><dt>Payment</dt><dd><code>{pay.provider_payment_id}</code></dd></div>}
              {o.provider_order_id && <div><dt>Razorpay order</dt><dd><code>{o.provider_order_id}</code></dd></div>}
            </dl>
          </Card>
          <Card title="Timeline">
            <ol className="adm-po-tl">
              {timeline.map(([k, t]) => <li key={k} className={t ? 'on' : ''}><b>{k}</b><span>{t ? when(t) : '—'}</span></li>)}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
