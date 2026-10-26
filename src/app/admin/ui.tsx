import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatMoney, isCurrency } from '@/lib/money';

/* ------------------------------------------------------------------ formatting (all times in India) */
const TZ = 'Asia/Kolkata';
export const when = (s: string | null | undefined) => (s ? new Date(s).toLocaleString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const day = (s: string) => new Date(s).toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const clock = (s: string) => new Date(s).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
export const money = (a: number, c: string) => (isCurrency(c) ? formatMoney(a, c) : `${a / 100} ${c}`);
export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('en-IN');
export function ago(s: string | null | undefined) {
  if (!s) return '—';
  const sec = Math.max(0, (Date.now() - new Date(s).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400)} d ago`;
  return day(s);
}
export function duration(sec: number) {
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
export function country(code: string | null | undefined) {
  if (!code || code.length !== 2 || code === '??') return code === '??' || !code ? 'Unknown' : code;
  const flag = String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
  try { return `${flag} ${regionNames.of(code.toUpperCase())}`; } catch { return code; }
}
export const place = (v: { city?: string | null; region?: string | null; country?: string | null }) =>
  [v.city, v.region && v.region !== v.city ? v.region : null].filter(Boolean).join(', ') + (v.country ? `${v.city ? ' · ' : ''}${country(v.country)}` : '') || 'Unknown';
export const shortId = (id: string) => `#${id.slice(0, 6)}`;
export const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/** id → email for a set of account ids */
export async function emails(ids: (string | null | undefined)[]) {
  const list = [...new Set(ids.filter(Boolean) as string[])];
  if (!list.length) return new Map<string, { email: string; name: string }>();
  const { data } = await supabaseAdmin().from('profiles').select('id, email, full_name').in('id', list);
  return new Map((data ?? []).map((p) => [p.id, { email: p.email ?? '', name: p.full_name ?? '' }]));
}

/* ------------------------------------------------------------------ layout pieces */
export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="adm-head">
      <div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>
      {children ? <div className="adm-head-tools">{children}</div> : null}
    </header>
  );
}

export function Stat({ label, value, note, href }: { label: string; value: React.ReactNode; note?: React.ReactNode; href?: string }) {
  const body = <><span className="k">{label}</span><b>{value}</b>{note ? <span className="n">{note}</span> : null}</>;
  return href ? <Link href={href} className="adm-stat">{body}</Link> : <div className="adm-stat">{body}</div>;
}

export function Card({ title, action, children, flush }: { title?: string; action?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return (
    <section className={`adm-card${flush ? ' flush' : ''}`}>
      {title || action ? <header><h2>{title}</h2>{action}</header> : null}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="adm-empty">{children}</p>;
}

/** Horizontal bars: one hue, magnitude only. */
export function BarList({ rows, format = (k) => k, href }: { rows: { k: string; n: number; u?: number }[]; format?: (k: string) => React.ReactNode; href?: (k: string) => string }) {
  if (!rows.length) return <Empty>No data yet.</Empty>;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <ul className="adm-bars">
      {rows.map((r) => (
        <li key={r.k} title={`${r.k}: ${r.n}`}>
          <span className="bar" style={{ width: `${(r.n / max) * 100}%` }} />
          <span className="lab">{href ? <Link href={href(r.k)}>{format(r.k)}</Link> : format(r.k)}</span>
          <span className="val">{num(r.n)}{r.u != null ? <small> · {num(r.u)} people</small> : null}</span>
        </li>
      ))}
    </ul>
  );
}

/** Daily visitors as columns, with a hover readout. */
export function DailyChart({ rows }: { rows: { day: string; visitors: number; pageviews: number }[] }) {
  const max = Math.max(...rows.map((r) => r.visitors), 1);
  const nice = Math.max(1, Math.ceil(max / 4)) * 4;
  return (
    <div className="adm-chart" role="img" aria-label={`Visitors per day, last ${rows.length} days`}>
      <div className="grid">
        {[1, 0.75, 0.5, 0.25, 0].map((f) => <span key={f} style={{ bottom: `${f * 100}%` }}><i>{Math.round(nice * f)}</i></span>)}
      </div>
      <div className="cols">
        {rows.map((r) => (
          <div key={r.day} className="col" tabIndex={0}>
            <span className="fill" style={{ height: `${(r.visitors / nice) * 100}%` }} />
            <span className="tip"><b>{new Date(r.day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</b>{r.visitors} visitors · {r.pageviews} page views</span>
          </div>
        ))}
      </div>
      <div className="axis">
        <span>{new Date(rows[0]?.day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export function Pager({ page, size, total, base, params = {} }: { page: number; size: number; total: number; base: string; params?: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const href = (p: number) => { const q = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]); return `${base}?${q}`; };
  return (
    <nav className="adm-pager" aria-label="Pages">
      {page > 1 ? <Link href={href(page - 1)}>← Newer</Link> : <span />}
      <span>Page {page} of {pages} · {num(total)} total</span>
      {page < pages ? <Link href={href(page + 1)}>Older →</Link> : <span />}
    </nav>
  );
}

export function Filters({ base, current, options, name = 'f' }: { base: string; current?: string; options: [string, string][]; name?: string }) {
  return (
    <nav className="adm-filters" aria-label="Filter">
      {options.map(([v, label]) => (
        <Link key={v} href={v ? `${base}${base.includes('?') ? '&' : '?'}${name}=${v}` : base} className={(current ?? '') === v ? 'on' : ''}>{label}</Link>
      ))}
    </nav>
  );
}

export function Pill({ s }: { s: string }) {
  return <span className={`pill ${s}`}>{s === 'created' ? 'not paid' : s.replace('_', ' ')}</span>;
}

export const pageNum = (v: string | string[] | undefined) => Math.max(1, Number(Array.isArray(v) ? v[0] : v) || 1);
export const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** visitor id → a readable label (account email, or "Visitor #abc123 · City") */
export async function visitorNames(ids: string[]) {
  const list = [...new Set(ids)];
  const out = new Map<string, string>();
  if (!list.length) return out;
  const { data } = await supabaseAdmin().from('visitors').select('id, user_id, city, country').in('id', list);
  const who = await emails((data ?? []).map((v) => v.user_id));
  for (const v of data ?? []) {
    const u = v.user_id ? who.get(v.user_id) : null;
    out.set(v.id, u ? (u.name ? `${u.name} · ${u.email}` : u.email) : `Visitor #${v.id.slice(0, 6)}${v.city ? ` · ${v.city}` : v.country ? ` · ${v.country}` : ''}`);
  }
  return out;
}

/** an ISO time this many milliseconds ago */
export const sinceIso = (ms: number) => new Date(Date.now() - ms).toISOString();
export const isLive = (s: string) => Date.now() - new Date(s).getTime() < 300_000;
