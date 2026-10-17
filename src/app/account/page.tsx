import Link from 'next/link';
import type { Metadata } from 'next';
import { requireViewer } from '@/lib/auth.server';
import { createClient } from '@/lib/supabase/server';
import { formatMoney, isCurrency } from '@/lib/money';
import { AuthForm } from '@/components/auth-form';
import { RetryBuild } from '@/components/retry-build';
import { updateName } from '../login/actions';
import { toolBySlug } from '@/lib/tools';

export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } };

const when = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const money = (a: number, c: string) => (isCurrency(c) ? formatMoney(a, c) : `${a / 100} ${c}`);
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

export default async function Account() {
  const viewer = await requireViewer('/account');
  const supabase = await createClient();
  const [files, orders, payments, downloads] = await Promise.all([
    supabase.from('files').select('id, name, size_bytes, created_at, tool_slug, design_id, designs(name, preview)').order('created_at', { ascending: false }),
    supabase.from('orders').select('id, tool_slug, currency, amount_minor, status, created_at, provider_order_id, designs(name)').order('created_at', { ascending: false }).limit(100),
    supabase.from('payments').select('provider_payment_id, amount_minor, currency, status, method, created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('downloads').select('file_id'),
  ]);
  const dl = new Map<string, number>();
  for (const d of downloads.data ?? []) dl.set(d.file_id, (dl.get(d.file_id) ?? 0) + 1);
  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

  return (
    <div className="wrap">
      <div className="page-title" style={{ paddingBottom: 28 }}>
        <p className="eyebrow">Account</p>
        <h1>{viewer.name ? `Hello, ${viewer.name.split(' ')[0]}.` : 'Your account'}</h1>
        <p className="lede">{viewer.email}</p>
      </div>
      <div className="dash">
        <nav aria-label="Account sections">
          <a href="#files" className="on">Files</a>
          <a href="#orders">Orders</a>
          <a href="#payments">Payments</a>
          <a href="#profile">Profile</a>
        </nav>
        <div>
          <section id="files">
            <h2>Your files</h2>
            {files.data?.length ? (
              <div className="files">
                {files.data.map((f) => {
                  const d = one(f.designs as { name: string; preview: string | null } | { name: string; preview: string | null }[] | null);
                  return (
                    <article className="file" key={f.id}>
                      <div className="thumb">{d?.preview ? <img src={d.preview} alt={`Shadow preview of ${d.name}`} /> : null}</div>
                      <div className="meta">
                        <b>{d?.name ?? f.name}</b>
                        <span>{toolBySlug(f.tool_slug)?.name ?? f.tool_slug} · {when(f.created_at)} · {kb(f.size_bytes)}{dl.get(f.id) ? ` · downloaded ${dl.get(f.id)}×` : ''}</span>
                        <a className="btn small" href={`/api/files/${f.id}/download`}>Download zip ↓</a>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty">
                <p>No files yet. Designs you buy appear here, ready to download again whenever you need them.</p>
                <Link className="btn" href="/tools/shadow-lamp/make">Make a shadow lamp</Link>
              </div>
            )}
          </section>

          <section id="orders">
            <h2>Orders</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Design</th><th>Tool</th><th>Status</th><th className="num">Amount</th><th>Order</th></tr></thead>
                <tbody>
                  {(orders.data ?? []).map((o) => (
                    <tr key={o.id}>
                      <td>{when(o.created_at)}</td>
                      <td>{one(o.designs as { name: string } | { name: string }[] | null)?.name ?? '—'}</td>
                      <td>{toolBySlug(o.tool_slug)?.name ?? o.tool_slug}</td>
                      <td><span className={`pill ${o.status}`}>{o.status === 'created' ? 'not paid' : o.status}</span>{o.status === 'paid' && <> <RetryBuild orderId={o.id} /></>}</td>
                      <td className="num">{money(o.amount_minor, o.currency)}</td>
                      <td className="id">{o.provider_order_id ?? o.id.slice(0, 8)}</td>
                    </tr>
                  ))}
                  {!orders.data?.length && <tr><td colSpan={6} className="muted">No orders yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section id="payments">
            <h2>Payments</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Payment</th><th>Method</th><th>Status</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {(payments.data ?? []).map((p) => (
                    <tr key={p.provider_payment_id}>
                      <td>{when(p.created_at)}</td>
                      <td className="id">{p.provider_payment_id}</td>
                      <td>{p.method ?? '—'}</td>
                      <td><span className={`pill ${p.status}`}>{p.status}</span></td>
                      <td className="num">{money(p.amount_minor, p.currency)}</td>
                    </tr>
                  ))}
                  {!payments.data?.length && <tr><td colSpan={5} className="muted">No payments yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: 14, marginTop: 14 }}>Razorpay emails a receipt for every payment. Need an invoice with your GSTIN? Write to us with the payment ID.</p>
          </section>

          <section id="profile">
            <h2>Profile</h2>
            <div className="split" style={{ gap: 32 }}>
              <AuthForm action={updateName} submit="Save name" fields={[{ name: 'name', label: 'Your name', type: 'text', autoComplete: 'name', defaultValue: viewer.name }]} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
                <Link className="btn ghost" href="/account/password">Change password</Link>
                <form action="/auth/signout" method="post"><button className="btn ghost">Sign out</button></form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
