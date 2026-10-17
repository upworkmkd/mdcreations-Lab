import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TOOLS } from '@/lib/tools';
import { formatMoney, isCurrency } from '@/lib/money';
import { ToolRow } from './tool-row';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };
const when = (s: string) => new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default async function Admin() {
  await requireAdmin();
  const db = supabaseAdmin();
  const [tools, prices, orders, users, files] = await Promise.all([
    db.from('tools').select('slug, name, status').order('sort'),
    db.from('tool_prices').select('tool_slug, currency, amount_minor'),
    db.from('orders').select('id, user_id, tool_slug, currency, amount_minor, status, provider, provider_order_id, error, created_at, designs(name)').order('created_at', { ascending: false }).limit(50),
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('files').select('id', { count: 'exact', head: true }),
  ]);
  const ids = [...new Set((orders.data ?? []).map((o) => o.user_id))];
  const { data: people } = ids.length ? await db.from('profiles').select('id, email').in('id', ids) : { data: [] as { id: string; email: string }[] };
  const emailOf = new Map((people ?? []).map((p) => [p.id, p.email]));
  const { data: paidRows } = await db.from('orders').select('currency, amount_minor').in('status', ['paid', 'fulfilled']).eq('provider', 'razorpay');
  const revenue: Record<string, number> = {};
  for (const r of paidRows ?? []) revenue[r.currency] = (revenue[r.currency] ?? 0) + r.amount_minor;
  const priceOf = (slug: string, c: string) => prices.data?.find((p) => p.tool_slug === slug && p.currency === c)?.amount_minor ?? null;
  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

  return (
    <div className="wrap">
      <div className="page-title" style={{ paddingBottom: 28 }}>
        <p className="eyebrow">Admin</p>
        <h1>The shop</h1>
      </div>
      <div style={{ padding: '40px 0 96px' }}>
        <div className="stats">
          <div><b>{revenue.INR ? formatMoney(revenue.INR, 'INR') : '₹0'}</b><span>Revenue, rupees</span></div>
          <div><b>{revenue.USD ? formatMoney(revenue.USD, 'USD') : '$0'}</b><span>Revenue, dollars</span></div>
          <div><b>{(paidRows ?? []).length}</b><span>Paid orders</span></div>
          <div><b>{files.count ?? 0}</b><span>Files built</span></div>
          <div><b>{users.count ?? 0}</b><span>Accounts</span></div>
        </div>

        <h2 className="serif" style={{ fontSize: 34, marginBottom: 8 }}>Tools and prices</h2>
        <p className="muted" style={{ marginBottom: 18, fontSize: 15 }}>Prices are per design download, including tax. Leave a price empty to stop selling in that currency. As admin you can download your own designs free.</p>
        <div className="tbl-wrap" style={{ marginBottom: 56 }}>
          <table className="tbl">
            <thead><tr><th>Tool</th><th>Status</th><th>Price ₹</th><th>Price $</th><th /></tr></thead>
            <tbody>
              {(tools.data ?? []).map((t) => (
                <ToolRow key={t.slug} slug={t.slug} name={TOOLS.find((x) => x.slug === t.slug)?.name ?? t.name} status={t.status} inr={priceOf(t.slug, 'INR')} usd={priceOf(t.slug, 'USD')} />
              ))}
              {tools.error && <tr><td colSpan={5} className="msg err">Could not read the tools table: {tools.error.message}. Did you run the SQL migration?</td></tr>}
            </tbody>
          </table>
        </div>

        <h2 className="serif" style={{ fontSize: 34, marginBottom: 18 }}>Latest orders</h2>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>When</th><th>Customer</th><th>Design</th><th>Status</th><th className="num">Amount</th><th>Razorpay order</th></tr></thead>
            <tbody>
              {(orders.data ?? []).map((o) => (
                <tr key={o.id}>
                  <td>{when(o.created_at)}</td>
                  <td>{emailOf.get(o.user_id) ?? o.user_id.slice(0, 8)}</td>
                  <td>{one(o.designs as { name: string } | { name: string }[] | null)?.name ?? '—'}</td>
                  <td><span className={`pill ${o.status}`}>{o.status}</span>{o.provider !== 'razorpay' && <span className="id"> · {o.provider}</span>}{o.error && <div className="id" style={{ color: 'var(--bad)' }}>{o.error}</div>}</td>
                  <td className="num">{isCurrency(o.currency) ? formatMoney(o.amount_minor, o.currency) : o.amount_minor}</td>
                  <td className="id">{o.provider_order_id ?? '—'}</td>
                </tr>
              ))}
              {!orders.data?.length && <tr><td colSpan={6} className="muted">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
