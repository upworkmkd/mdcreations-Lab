import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BulkForm, RowDelete, Sel } from '../bulk';
import { Card, Filters, PageHead, Pager, ago, emails, num, pageNum, place, shortId, str, when, sinceIso, isLive } from '../ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Visitors' };
const SIZE = 50;

export default async function Visitors({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = pageNum(sp.page), f = str(sp.f), q = str(sp.q).trim();
  const db = supabaseAdmin();
  let query = db.from('visitors').select('id, user_id, first_seen, last_seen, visits, pageviews, events, ip, city, region, country, browser, os, device_type, device_model, first_referrer, utm_source, last_path', { count: 'exact' });
  if (f === 'known') query = query.not('user_id', 'is', null);
  if (f === 'anon') query = query.is('user_id', null);
  if (f === 'returning') query = query.gt('visits', 1);
  if (f === 'online') query = query.gt('last_seen', sinceIso(5 * 60_000));
  if (f === 'new') query = query.gt('first_seen', sinceIso(24 * 3600_000));
  if (q) {
    if (q.includes('@')) {
      const { data: ps } = await db.from('profiles').select('id').ilike('email', `%${q}%`).limit(50);
      query = query.in('user_id', (ps ?? []).map((p) => p.id).concat('00000000-0000-0000-0000-000000000000'));
    } else {
      const like = `%${q.replace(/[%,()]/g, '')}%`;
      query = query.or(`ip.ilike.${like},city.ilike.${like},country.ilike.${like},browser.ilike.${like},first_referrer.ilike.${like}`);
    }
  }
  const { data, count, error } = await query.order('last_seen', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  const who = await emails((data ?? []).map((v) => v.user_id));

  return (
    <>
      <PageHead title="Visitors" sub="Every browser that accepted analytics cookies. A returning browser keeps one profile; it joins an account as soon as that person signs up or signs in.">
        <form className="adm-search" action="/admin/visitors">
          {f && <input type="hidden" name="f" value={f} />}
          <input name="q" defaultValue={q} placeholder="Search IP, city, country, browser or email" className="input" aria-label="Search visitors" />
        </form>
      </PageHead>
      <Filters base="/admin/visitors" current={f} options={[['', 'All'], ['online', 'Online now'], ['new', 'New today'], ['returning', 'Returning'], ['known', 'Signed up'], ['anon', 'Anonymous']]} />
      {error && <div className="adm-alert">{error.message}. Have you run the visitors SQL migration?</div>}
      <Card flush>
        <BulkForm kind="visitors" noun="visitor" warn="Their visits and activity go too.">
<div className="tbl-wrap"><table className="tbl adm-tbl">
          <thead><tr><th className="sel" /><th>Visitor</th><th>Place</th><th>Device</th><th className="num">Visits</th><th className="num">Pages</th><th>First seen</th><th>Last seen</th><th /></tr></thead>
          <tbody>
            {(data ?? []).map((v) => {
              const u = v.user_id ? who.get(v.user_id) : null;
              return (
                <tr key={v.id}>
                  <td className="sel"><Sel id={v.id} /></td>
                  <td>
                    <Link href={`/admin/visitors/${v.id}`} className="adm-who">
                      <span className={`dot${isLive(v.last_seen) ? ' live' : ''}`} />
                      {u ? <b>{u.name || u.email}</b> : <b>Visitor {shortId(v.id)}</b>}
                    </Link>
                    <div className="id">{u ? u.email : v.ip ?? ''}{v.first_referrer ? ` · via ${v.first_referrer.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}` : v.utm_source ? ` · utm ${v.utm_source}` : ''}</div>
                  </td>
                  <td>{place(v)}</td>
                  <td>{[v.device_type, v.device_model].filter(Boolean).join(' ')}<div className="id">{[v.browser, v.os].filter(Boolean).join(' · ')}</div></td>
                  <td className="num">{num(v.visits)}</td>
                  <td className="num">{num(v.pageviews)}</td>
                  <td title={when(v.first_seen)}>{ago(v.first_seen)}</td>
                  <td title={when(v.last_seen)}>{ago(v.last_seen)}<div className="id">{v.last_path}</div></td>
                  <td className="act"><RowDelete id={v.id} /></td>
                </tr>
              );
            })}
            {!data?.length && <tr><td colSpan={9} className="muted">No visitors match.</td></tr>}
          </tbody>
        </table></div>
        </BulkForm>
      </Card>
      <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/visitors" params={{ f, q }} />
    </>
  );
}
