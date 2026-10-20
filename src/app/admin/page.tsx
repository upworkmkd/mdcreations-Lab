import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatMoney } from '@/lib/money';
import { BarList, Card, DailyChart, Empty, Filters, PageHead, Pill, Stat, ago, country, duration, emails, money, num, one, str, visitorNames, when } from './ui';
import { Timeline, type Ev } from './timeline';
import { hasAccess } from '@/lib/plans.server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Overview' };

type Stats = {
  totals: Record<string, number>;
  daily: { day: string; visitors: number; pageviews: number }[];
  pages: { k: string; n: number; u: number }[]; referrers: { k: string; n: number }[]; campaigns: { k: string; n: number }[];
  countries: { k: string; n: number }[]; cities: { k: string; n: number }[]; devices: { k: string; n: number }[];
  browsers: { k: string; n: number }[]; os: { k: string; n: number }[]; actions: { k: string; n: number }[];
};

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(str(sp.days))) ? Number(str(sp.days)) : 30;
  const db = supabaseAdmin();
  const [stats, users, designs, files, downloads, paid, subs, orders, feed, anonStats] = await Promise.all([
    db.rpc('admin_stats', { p_days: days }),
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('designs').select('id', { count: 'exact', head: true }),
    db.from('files').select('id', { count: 'exact', head: true }),
    db.from('downloads').select('id', { count: 'exact', head: true }),
    db.from('orders').select('currency, amount_minor').in('status', ['paid', 'fulfilled']).eq('provider', 'razorpay'),
    db.from('subscriptions').select('status, current_end, currency, amount_minor, cancel_at_period_end'),
    db.from('orders').select('id, user_id, currency, amount_minor, status, created_at, designs(name)').order('created_at', { ascending: false }).limit(8),
    db.from('visitor_events').select('*').in('type', ['signup', 'email_confirmed', 'signin', 'design_saved', 'checkout', 'payment', 'download', 'payment_cancelled', 'purchase_error', 'subscribed', 'subscription_cancel', 'plan_build']).order('created_at', { ascending: false }).limit(15),
    db.rpc('admin_anon_stats', { p_days: days }),
  ]);
  const s = stats.data as Stats | null;
  const revenue: Record<string, number> = {};
  for (const r of paid.data ?? []) revenue[r.currency] = (revenue[r.currency] ?? 0) + r.amount_minor;
  const [who, names] = await Promise.all([emails((orders.data ?? []).map((o) => o.user_id)), visitorNames((feed.data ?? []).map((e) => e.visitor_id))]);
  const t = s?.totals ?? {};

  return (
    <>
      <PageHead title="Overview" sub="Visitors, sales and what people do on the site. Times are India time.">
        <Filters base="/admin" name="days" current={String(days === 30 ? '' : days)} options={[['7', '7 days'], ['', '30 days'], ['90', '90 days']]} />
      </PageHead>

      {stats.error && <div className="adm-alert">Visitor numbers are not available: {stats.error.message}. Run <code>supabase/migrations/20261019000000_visitors.sql</code> in the Supabase SQL editor.</div>}

      <div className="adm-stats">
        <Stat label="Online now" value={num(t.online)} note="active in the last 5 min" href="/admin/activity" />
        <Stat label="Visitors today" value={num(t.today)} />
        <Stat label={`Visitors, ${days} days`} value={num(t.visitors)} note={`${num(t.new_visitors)} new · ${num(t.returning)} returning`} href="/admin/visitors" />
        <Stat label="Anonymous visits" value={num((anonStats.data as { totals?: Record<string, number> } | null)?.totals?.visits)} note={`${num((anonStats.data as { totals?: Record<string, number> } | null)?.totals?.views)} page views, no cookies`} href="/admin/anonymous" />
        <Stat label="Page views" value={num(t.pageviews)} note={`${num(t.sessions)} visits · avg ${duration(t.avg_session_s ?? 0)}`} />
        <Stat label="Sign-ups" value={num(t.signups)} note={`${num(users.count)} accounts in all`} href="/admin/users" />
        <Stat label="Revenue" value={revenue.INR ? formatMoney(revenue.INR, 'INR') : '₹0'} note={revenue.USD ? `+ ${formatMoney(revenue.USD, 'USD')}` : `${num((paid.data ?? []).length)} paid orders`} href="/admin/orders" />
        <Stat label="Active plans" value={num((subs.data ?? []).filter((x) => hasAccess(x)).length)} note={(() => { const m: Record<string, number> = {}; for (const x of subs.data ?? []) if (hasAccess(x) && !x.cancel_at_period_end && x.status !== 'cancelled') m[x.currency] = (m[x.currency] ?? 0) + x.amount_minor; return Object.keys(m).length ? `${Object.entries(m).map(([c, n]) => money(n, c)).join(' + ')} a month` : 'no subscribers yet'; })()} href="/admin/subscriptions" />
        <Stat label="Designs saved" value={num(designs.count)} href="/admin/designs" />
        <Stat label="Files built · downloads" value={`${num(files.count)} · ${num(downloads.count)}`} href="/admin/downloads" />
      </div>

      <Card title={`Visitors per day`}>
        {s?.daily?.length ? <DailyChart rows={s.daily} /> : <Empty>No visits recorded yet.</Empty>}
      </Card>

      <div className="adm-grid2">
        <Card title="Top pages"><BarList rows={s?.pages ?? []} format={(k) => <code>{k}</code>} /></Card>
        <Card title="Where they come from"><BarList rows={s?.referrers ?? []} /></Card>
        <Card title="Countries"><BarList rows={s?.countries ?? []} format={country} /></Card>
        <Card title="Cities"><BarList rows={s?.cities ?? []} /></Card>
        <Card title="Devices"><BarList rows={s?.devices ?? []} format={(k) => k[0].toUpperCase() + k.slice(1)} /></Card>
        <Card title="Browsers"><BarList rows={s?.browsers ?? []} /></Card>
        <Card title="Operating systems"><BarList rows={s?.os ?? []} /></Card>
        <Card title="What people do"><BarList rows={s?.actions ?? []} /></Card>
        {s?.campaigns?.length ? <Card title="Campaigns (utm)"><BarList rows={s.campaigns} /></Card> : null}
      </div>

      <div className="adm-grid2 wide">
        <Card title="Latest key moments" action={<Link href="/admin/activity">All activity →</Link>}>
          <Timeline events={(feed.data ?? []) as Ev[]} showVisitor names={names} />
        </Card>
        <Card title="Latest orders" action={<Link href="/admin/orders">All orders →</Link>} flush>
          <div className="tbl-wrap"><table className="tbl adm-tbl">
            <thead><tr><th>When</th><th>Customer</th><th>Status</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {(orders.data ?? []).map((o) => (
                <tr key={o.id}>
                  <td title={when(o.created_at)}>{ago(o.created_at)}<div className="id">{one(o.designs as { name: string } | { name: string }[] | null)?.name ?? '—'}</div></td>
                  <td><Link href={`/admin/users/${o.user_id}`}>{who.get(o.user_id)?.email ?? o.user_id.slice(0, 8)}</Link></td>
                  <td><Pill s={o.status} /></td>
                  <td className="num">{money(o.amount_minor, o.currency)}</td>
                </tr>
              ))}
              {!orders.data?.length && <tr><td colSpan={4} className="muted">No orders yet.</td></tr>}
            </tbody>
          </table></div>
        </Card>
      </div>
    </>
  );
}
