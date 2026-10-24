import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BulkForm, RowDelete, Sel } from '../bulk';
import { ScoreBadge } from './score';
import { Card, Filters, PageHead, Pager, ago, duration, emails, num, pageNum, place, shortId, str, when, sinceIso, isLive } from '../ui';

const refName = (r: string | null) => (r ? r.replace(/^utm: /, 'utm ') : 'Direct');

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Visitors' };
const SIZE = 50;

export default async function Visitors({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = pageNum(sp.page), f = str(sp.f), q = str(sp.q).trim();
  const db = supabaseAdmin();
  let query = db.from('visitor_overview').select('id, user_id, first_seen, last_seen, visits, pageviews, events, ip, city, region, country, browser, os, device_type, device_model, first_referrer, utm_source, last_path, referral, time_s, score, pictures_chosen, pictures_kept', { count: 'exact' });
  if (f === 'known') query = query.not('user_id', 'is', null);
  if (f === 'anon') query = query.is('user_id', null);
  if (f === 'returning') query = query.gt('visits', 1);
  if (f === 'online') query = query.gt('last_seen', sinceIso(5 * 60_000));
  if (f === 'new') query = query.gt('first_seen', sinceIso(24 * 3600_000));
  if (f === 'pictures') query = query.gt('pictures_chosen', 0);
  if (f === 'hot') query = query.gte('score', 50);
  if (f === 'mobile') query = query.in('device_type', ['mobile', 'tablet']);
  if (f === 'desktop') query = query.or('device_type.is.null,device_type.eq.desktop');
  if (q) {
    if (q.includes('@')) {
      const { data: ps } = await db.from('profiles').select('id').ilike('email', `%${q}%`).limit(50);
      query = query.in('user_id', (ps ?? []).map((p) => p.id).concat('00000000-0000-0000-0000-000000000000'));
    } else {
      const like = `%${q.replace(/[%,()]/g, '')}%`;
      query = query.or(`ip.ilike.${like},city.ilike.${like},country.ilike.${like},browser.ilike.${like},first_referrer.ilike.${like},utm_source.ilike.${like}`);
    }
  }
  const sort = str(sp.sort);
  const order: [string, boolean] = sort === 'score' ? ['score', false] : sort === 'time' ? ['time_s', false] : ['last_seen', false];
  const { data, count, error } = await query.order(order[0], { ascending: order[1] }).order('last_seen', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  const who = await emails((data ?? []).map((v) => v.user_id));

  return (
    <>
      <PageHead title="Visitors" sub="Every browser that accepted analytics cookies. Score (0–100) shows how far someone got: pages and clicks a little, a picture or a saved design more, checkout, sign-up, payment and downloads the most. Picture: whether they loaded one into a tool, and how many copies were kept.">
        <form className="adm-search" action="/admin/visitors">
          {f && <input type="hidden" name="f" value={f} />}
          {sort && <input type="hidden" name="sort" value={sort} />}
          <input name="q" defaultValue={q} placeholder="Search IP, city, referral, browser or email" className="input" aria-label="Search visitors" />
        </form>
      </PageHead>
      <div className="adm-filterbar">
        <Filters base={`/admin/visitors${sort ? `?sort=${sort}` : ''}`} current={f} options={[['', 'All'], ['online', 'Online now'], ['new', 'New today'], ['returning', 'Returning'], ['hot', 'Hot (score 50+)'], ['pictures', 'Uploaded a picture'], ['mobile', 'Mobile'], ['desktop', 'Desktop'], ['known', 'Signed up'], ['anon', 'Anonymous']]} />
        <Filters name="sort" base={`/admin/visitors${f ? `?f=${f}` : ''}`} current={sort} options={[['', 'Latest'], ['score', 'Top score'], ['time', 'Most time']]} />
      </div>
      {error && <div className="adm-alert">{error.message}. Have you run the visitors SQL migration?</div>}
      <Card flush>
        <BulkForm kind="visitors" noun="visitor" warn="Their visits and activity go too.">
<div className="tbl-wrap"><table className="tbl adm-tbl">
          <thead><tr><th className="sel" /><th>Visitor</th><th>Referral</th><th>Device</th><th>Visits</th><th className="num">Time spent</th><th>Score</th><th>Picture</th><th>Last seen</th><th /></tr></thead>
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
                    <div className="id">{u ? u.email : v.ip ?? ''}</div>
                  </td>
                  <td>{v.referral ? <b className="adm-ref">{refName(v.referral)}</b> : <span className="muted">Direct</span>}<div className="id">{place(v)}</div></td>
                  <td><span className={`adm-dev ${v.device_type === 'mobile' || v.device_type === 'tablet' ? 'm' : 'd'}`}>{v.device_type === 'mobile' ? 'Mobile' : v.device_type === 'tablet' ? 'Tablet' : 'Desktop'}</span><div className="id">{[v.browser, v.os].filter(Boolean).join(' · ')}{v.device_model ? ` · ${v.device_model}` : ''}</div></td>
                  <td>{v.visits > 1 ? <span className="adm-tag ret">Returning</span> : <span className="adm-tag new">New</span>}<div className="id">{num(v.visits)} {v.visits === 1 ? 'visit' : 'visits'} · {num(v.pageviews)} pages</div></td>
                  <td className="num">{duration(v.time_s)}</td>
                  <td><ScoreBadge n={v.score} /></td>
                  <td>{v.pictures_chosen > 0 ? <span className="adm-tag pic">Yes{v.pictures_kept ? ` · ${v.pictures_kept} kept` : ''}</span> : <span className="muted">No</span>}</td>
                  <td title={when(v.last_seen)}>{ago(v.last_seen)}<div className="id">{v.last_path}</div></td>
                  <td className="act"><RowDelete id={v.id} /></td>
                </tr>
              );
            })}
            {!data?.length && <tr><td colSpan={10} className="muted">No visitors match.</td></tr>}
          </tbody>
        </table></div>
        </BulkForm>
      </Card>
      <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/visitors" params={{ f, q, sort }} />
    </>
  );
}
