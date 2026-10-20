import { supabaseAdmin } from '@/lib/supabase/admin';
import { BarList, Card, DailyChart, Empty, Filters, PageHead, Stat, ago, clock, country, day, duration, num, pageNum, str, when } from '../ui';
import { BulkForm, RowDelete, Sel } from '../bulk';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anonymous visits' };
const ROWS = 1500;

type Row = { id: number; visit: string; type: string; path: string; title: string | null; referrer: string | null; utm_source: string | null; country: string | null; device_type: string | null; browser: string | null; os: string | null; seconds: number | null; scroll: number | null; created_at: string };
type Stats = { totals: Record<string, number>; daily: { day: string; visitors: number; pageviews: number }[]; pages: { k: string; n: number; u: number }[]; referrers: { k: string; n: number }[]; countries: { k: string; n: number }[]; devices: { k: string; n: number }[]; browsers: { k: string; n: number }[] };

export default async function Anonymous({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = pageNum(sp.page), days = [7, 30, 90].includes(Number(str(sp.days))) ? Number(str(sp.days)) : 30;
  const db = supabaseAdmin();
  const [stats, rows] = await Promise.all([
    db.rpc('admin_anon_stats', { p_days: days }),
    db.from('anon_views').select('*').order('created_at', { ascending: false }).range((page - 1) * ROWS, page * ROWS - 1),
  ]);
  const s = stats.data as Stats | null, t = s?.totals ?? {};
  // group page views into visits (newest first), pages in the order they were opened
  const visits = new Map<string, Row[]>();
  for (const r of (rows.data ?? []) as Row[]) { if (!visits.has(r.visit)) visits.set(r.visit, []); visits.get(r.visit)!.push(r); }
  const list = [...visits.entries()].map(([visit, rs]) => {
    const asc = [...rs].reverse(), views = asc.filter((r) => r.type === 'pageview');
    const first = views[0] ?? asc[0];
    const time = new Map<string, { seconds: number; scroll: number }>();
    for (const r of asc) if (r.type === 'leave') time.set(r.path, { seconds: (time.get(r.path)?.seconds ?? 0) + (r.seconds ?? 0), scroll: Math.max(time.get(r.path)?.scroll ?? 0, r.scroll ?? 0) });
    const total = asc.reduce((a, r) => a + (r.type === 'leave' ? r.seconds ?? 0 : 0), 0);
    return { visit, first, views, time, total, last: asc[asc.length - 1].created_at };
  });

  return (
    <>
      <PageHead title="Anonymous visits" sub="Visitors who have not accepted analytics cookies (or chose “Essential only”). Counted without cookies: no IP, no city and no way to recognise them on their next visit. A reload starts a new visit.">
        <Filters base="/admin/anonymous" name="days" current={String(days === 30 ? '' : days)} options={[['7', '7 days'], ['', '30 days'], ['90', '90 days']]} />
      </PageHead>
      {stats.error && <div className="adm-alert">{stats.error.message}. Run <code>supabase/migrations/20261020400000_anonymous_views.sql</code> in the Supabase SQL editor.</div>}
      <div className="adm-stats">
        <Stat label="Visits today" value={num(t.today_visits)} />
        <Stat label={`Visits, ${days} days`} value={num(t.visits)} />
        <Stat label="Page views" value={num(t.views)} />
        <Stat label="Avg time on a page" value={duration(t.avg_seconds ?? 0)} />
      </div>
      <Card title="Anonymous visits per day">{s?.daily?.length ? <DailyChart rows={s.daily} /> : <Empty>Nothing yet.</Empty>}</Card>
      <div className="adm-grid2">
        <Card title="Top pages"><BarList rows={s?.pages ?? []} format={(k) => <code>{k}</code>} /></Card>
        <Card title="Where they come from"><BarList rows={s?.referrers ?? []} /></Card>
        <Card title="Countries"><BarList rows={s?.countries ?? []} format={country} /></Card>
        <Card title="Devices and browsers"><BarList rows={[...(s?.devices ?? []).map((d) => ({ ...d, k: d.k[0].toUpperCase() + d.k.slice(1) })), ...(s?.browsers ?? [])]} /></Card>
      </div>
      <Card title="Latest visits">
        {list.length ? (
          <BulkForm kind="anon" noun="visit">
            <ul className="adm-anon">
              {list.map((v) => (
                <li key={v.visit}>
                  <div className="h">
                    <Sel id={v.visit} />
                    <b title={when(v.first.created_at)}>{day(v.first.created_at)} · {clock(v.first.created_at)}</b>
                    <span className="muted">{[country(v.first.country), [v.first.device_type, v.first.browser, v.first.os].filter(Boolean).join(' · ')].join(' · ')}</span>
                    <span className="muted">{v.first.referrer ? `from ${v.first.referrer}` : 'direct'}{v.first.utm_source ? ` · utm ${v.first.utm_source}` : ''}</span>
                    <span className="muted">{v.views.length} page{v.views.length === 1 ? '' : 's'}{v.total ? ` · ${duration(v.total)}` : ''} · {ago(v.last)}</span>
                    <span className="act"><RowDelete id={v.visit} /></span>
                  </div>
                  <ol>
                    {v.views.map((r) => {
                      const tm = v.time.get(r.path);
                      return <li key={r.id}><time>{clock(r.created_at)}</time><code>{r.path}</code><span>{r.title?.replace(/ \| MD Creations Labs$/, '')}</span>{tm ? <span className="muted">{duration(tm.seconds)} · {tm.scroll}%</span> : null}</li>;
                    })}
                  </ol>
                </li>
              ))}
            </ul>
          </BulkForm>
        ) : <Empty>No anonymous visits yet.</Empty>}
        {(rows.data ?? []).length === ROWS && <p className="adm-pager"><span /><a href={`/admin/anonymous?page=${page + 1}`}>Older →</a></p>}
      </Card>
    </>
  );
}
