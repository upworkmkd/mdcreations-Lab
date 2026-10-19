import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/consent';
import { Card, Filters, PageHead, Pager, Stat, ago, country, duration, emails, num, pageNum, place, shortId, str, when } from '../../ui';
import { NOISE, Timeline, type Ev, type Sess } from '../../timeline';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Visitor' };
const SIZE = 300;

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="adm-facts">{rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export default async function Visitor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await searchParams;
  const page = pageNum(sp.page), f = str(sp.f);
  const db = supabaseAdmin();
  const { data: v } = await db.from('visitors').select('*').eq('id', id).maybeSingle();
  if (!v) notFound();
  let evq = db.from('visitor_events').select('*', { count: 'exact' }).eq('visitor_id', id);
  if (f === 'key') evq = evq.not('type', 'in', `(${NOISE.join(',')})`);
  const [ev, sessions, others] = await Promise.all([
    evq.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1),
    db.from('visitor_sessions').select('*').eq('visitor_id', id).order('started_at', { ascending: false }).limit(200),
    v.user_id ? db.from('visitors').select('id, last_seen, browser, os, device_type, city').eq('user_id', v.user_id).neq('id', id).order('last_seen', { ascending: false }) : Promise.resolve({ data: [] as { id: string; last_seen: string; browser: string | null; os: string | null; device_type: string | null; city: string | null }[] }),
  ]);
  const u = v.user_id ? (await emails([v.user_id])).get(v.user_id) : null;
  const sess = (sessions.data ?? []) as Sess[];
  const totalTime = sess.reduce((a, s) => a + (new Date(s.last_seen).getTime() - new Date(s.started_at).getTime()) / 1000, 0);

  return (
    <>
      <PageHead title={u ? u.name || u.email : `Visitor ${shortId(v.id)}`} sub={<>{u ? <><Link href={`/admin/users/${v.user_id}`}>{u.email}</Link> · </> : 'Anonymous · '}{place(v)} · last seen {ago(v.last_seen)}</>}>
        <Link href="/admin/visitors" className="btn small ghost">← All visitors</Link>
      </PageHead>

      <div className="adm-stats">
        <Stat label="Visits" value={num(v.visits)} note={v.visits > 1 ? 'returning visitor' : 'first visit'} />
        <Stat label="Pages viewed" value={num(v.pageviews)} />
        <Stat label="Actions" value={num(v.events)} />
        <Stat label="Time on site" value={duration(totalTime)} />
        <Stat label="First seen" value={ago(v.first_seen)} note={when(v.first_seen)} />
        <Stat label="Last seen" value={ago(v.last_seen)} note={when(v.last_seen)} />
      </div>

      <div className="adm-grid3">
        <Card title="Who and where">
          <Facts rows={[
            ['Account', u ? <Link href={`/admin/users/${v.user_id}`}>{u.email}</Link> : 'Not signed up'],
            ['IP address', v.ip], ['City', v.city], ['Region', v.region], ['Country', v.country ? country(v.country) : null],
            ['Map', v.latitude != null ? <a href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer">{v.latitude.toFixed(3)}, {v.longitude.toFixed(3)} ↗</a> : null],
            ['Time zone', v.timezone], ['Languages', v.languages || v.language],
            ['Cookie consent', v.consent ? `Accepted (${v.consent})` : null],
            ['Browser id', <code key="id">{v.id}</code>],
          ]} />
        </Card>
        <Card title="Device">
          <Facts rows={[
            ['Type', v.device_type], ['Device', [v.device_vendor, v.device_model].filter(Boolean).join(' ')],
            ['Browser', [v.browser, v.browser_version].filter(Boolean).join(' ')], ['System', [v.os, v.os_version].filter(Boolean).join(' ')],
            ['Screen', v.screen ? `${v.screen}${v.pixel_ratio ? ` @${v.pixel_ratio}x` : ''}` : null], ['Window', v.viewport],
            ['Touch', v.touch == null ? null : v.touch ? 'Yes' : 'No'], ['CPU cores', v.cpu_cores], ['Memory', v.memory_gb ? `${v.memory_gb} GB+` : null],
            ['Network', v.connection], ['Theme', v.color_scheme],
          ]} />
          {v.user_agent && <p className="adm-ua">{v.user_agent}</p>}
        </Card>
        <Card title="How they found us">
          <Facts rows={[
            ['First came from', v.first_referrer ? <a href={v.first_referrer} target="_blank" rel="noreferrer">{v.first_referrer.slice(0, 60)}</a> : 'Direct / unknown'],
            ['First page', v.first_landing ? <code>{v.first_landing}</code> : null],
            ['utm_source', v.utm_source], ['utm_medium', v.utm_medium], ['utm_campaign', v.utm_campaign], ['utm_term', v.utm_term], ['utm_content', v.utm_content],
            ['Last page', v.last_path ? <code>{v.last_path}</code> : null],
          ]} />
          {(others.data ?? []).length > 0 && (
            <>
              <h3 className="adm-sub">Same person, other browsers</h3>
              <ul className="adm-list">
                {(others.data ?? []).map((o) => <li key={o.id}><Link href={`/admin/visitors/${o.id}`}>{[o.device_type, o.browser, o.os].filter(Boolean).join(' · ') || shortId(o.id)}</Link> <span className="muted">{o.city ?? ''} · {ago(o.last_seen)}</span></li>)}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card title="Visits" flush>
        <div className="tbl-wrap"><table className="tbl adm-tbl">
          <thead><tr><th>Started</th><th>Length</th><th className="num">Pages</th><th className="num">Actions</th><th>Came from</th><th>Landed on</th><th>Device · place</th></tr></thead>
          <tbody>
            {sess.map((s) => (
              <tr key={s.id}>
                <td>{when(s.started_at)}</td>
                <td>{duration((new Date(s.last_seen).getTime() - new Date(s.started_at).getTime()) / 1000)}</td>
                <td className="num">{s.pageviews}</td><td className="num">{s.events}</td>
                <td>{s.referrer ? s.referrer.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40) : s.utm_source ? `utm ${s.utm_source}` : 'Direct'}</td>
                <td><code>{s.landing ?? '—'}</code></td>
                <td>{[s.device_type, s.browser].filter(Boolean).join(' · ')}<div className="id">{[s.city, s.ip].filter(Boolean).join(' · ')}</div></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>

      <Card title="Activity timeline" action={<Filters base={`/admin/visitors/${id}`} current={f} options={[['', 'Everything'], ['key', 'Pages and key actions']]} />}>
        <Timeline events={(ev.data ?? []) as Ev[]} sessions={sess} />
        <Pager page={page} size={SIZE} total={ev.count ?? 0} base={`/admin/visitors/${id}`} params={{ f }} />
      </Card>
    </>
  );
}
