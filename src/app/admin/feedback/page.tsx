import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TOOLS } from '@/lib/tools';
import { setFeedback } from '../actions';
import { BulkForm, RowDelete, Sel } from '../bulk';
import { Card, Filters, PageHead, Pager, Stat, ago, num, pageNum, shortId, sinceIso, str, visitorNames, when } from '../ui';
import { FACE, FeedbackDrawer, WORD, toolName } from './drawer';
import { UUID_RE } from '@/lib/consent';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Feedback' };
const SIZE = 50;

type Row = { id: string; rating: number; tool_slug: string | null; message: string | null; name: string | null; email: string | null; page: string | null; visitor_id: string | null; user_id: string | null; status: string; created_at: string };

export default async function Feedback({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = pageNum(sp.page), tool = str(sp.tool), open = str(sp.open);
  const visitor = UUID_RE.test(str(sp.visitor)) ? str(sp.visitor) : '';
  const f = str(sp.f) || (visitor ? 'all' : 'open');
  // the list's own address, with or without a note open in the drawer
  const href = (o: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ f: f === 'open' ? '' : f, tool, visitor, page: page > 1 ? page : '', ...o })) if (v !== '' && v != null) q.set(k, String(v));
    const s2 = q.toString(); return `/admin/feedback${s2 ? `?${s2}` : ''}`;
  };
  const db = supabaseAdmin();
  let q = db.from('feedback').select('id, rating, tool_slug, message, name, email, page, visitor_id, user_id, status, created_at', { count: 'exact' });
  if (f === 'open') q = q.neq('status', 'archived');
  if (f === 'new' || f === 'archived') q = q.eq('status', f);
  if (f === 'low') q = q.lte('rating', 2).neq('status', 'archived');
  if (f === 'email') q = q.not('email', 'is', null);
  if (tool) q = q.eq('tool_slug', tool);
  if (visitor) q = q.eq('visitor_id', visitor);
  const [{ data, count, error }, all] = await Promise.all([
    q.order('created_at', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1),
    db.from('feedback').select('rating, status').gt('created_at', sinceIso(90 * 86400_000)).limit(5000),
  ]);
  const rows = (data ?? []) as Row[], stats = all.data ?? [];
  const avg = stats.length ? stats.reduce((a, r) => a + r.rating, 0) / stats.length : 0;
  const names = await visitorNames(rows.map((r) => r.visitor_id).filter(Boolean) as string[]);

  return (
    <>
      <PageHead title="Feedback" sub="What visitors told us in the “How do you like it?” card. Click a note to open it. Name and email are optional, so many notes are anonymous." />
      <div className="adm-stats">
        <Stat label="Notes, 90 days" value={num(stats.length)} />
        <Stat label="Average" value={stats.length ? `${avg.toFixed(1)} / 5` : '—'} note={stats.length ? FACE[Math.round(avg)] + ' ' + WORD[Math.round(avg)] : undefined} />
        <Stat label="Unread" value={num(stats.filter((r) => r.status === 'new').length)} href="/admin/feedback?f=new" />
        <Stat label="Unhappy (1–2)" value={num(stats.filter((r) => r.rating <= 2).length)} href="/admin/feedback?f=low" />
      </div>
      {visitor && <div className="adm-alert soft">Showing feedback from <Link href={`/admin/visitors/${visitor}`}>{(await visitorNames([visitor])).get(visitor) ?? `Visitor ${shortId(visitor)}`}</Link> · <Link href="/admin/feedback">Show everyone</Link></div>}
      <div className="adm-filterbar">
        <Filters base={`/admin/feedback${tool ? `?tool=${tool}` : ''}`} current={f} options={[['open', 'Open'], ['new', 'Unread'], ['low', 'Unhappy'], ['email', 'Left an email'], ['archived', 'Archived'], ['all', 'Everything']]} />
        <Filters name="tool" base={`/admin/feedback?f=${f}`} current={tool} options={[['', 'All tools'], ...TOOLS.filter((t) => t.status !== 'hidden').map((t) => [t.slug, t.name] as [string, string])]} />
      </div>
      {error && <div className="adm-alert">{error.message}. Have you run the 20261024100000_feedback.sql migration?</div>}
      <Card flush>
        <BulkForm kind="feedback" noun="note">
          <div className="tbl-wrap"><table className="tbl adm-tbl">
            <thead><tr><th className="sel" /><th>Feeling</th><th>What they said</th><th>Who</th><th>Tool · page</th><th>When</th><th /><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === 'new' ? 'adm-unread' : undefined}>
                  <td className="sel"><Sel id={r.id} /></td>
                  <td><span className="adm-face" title={WORD[r.rating]}>{FACE[r.rating]}</span><div className="id">{r.rating}/5 · {WORD[r.rating]}</div></td>
                  <td className="adm-msg"><Link href={href({ open: r.id })} scroll={false} className="adm-open">{r.message ? (r.message.length > 220 ? r.message.slice(0, 220) + '…' : r.message) : <span className="muted">No comment, just the rating.</span>}</Link></td>
                  <td>
                    {r.name ? <b>{r.name}</b> : <span className="muted">No name</span>}
                    {r.email && <div><a href={`mailto:${r.email}?subject=${encodeURIComponent('Your feedback on MD Creations Labs')}`}>{r.email}</a></div>}
                    {r.user_id ? <div className="id"><Link href={`/admin/users/${r.user_id}`}>Account</Link></div> : r.visitor_id ? <div className="id"><Link href={`/admin/visitors/${r.visitor_id}`}>{names.get(r.visitor_id) ?? `Visitor ${shortId(r.visitor_id)}`}</Link></div> : null}
                  </td>
                  <td>{toolName(r.tool_slug)}<div className="id">{r.page}</div></td>
                  <td title={when(r.created_at)}>{ago(r.created_at)}</td>
                  <td className="act">
                    {/* inside the bulk-delete form, so each button carries its own action and target */}
                    <span className="adm-inline">
                      {r.status === 'new' && <button className="linkish" formAction={setFeedback.bind(null, r.id, 'read')}>Mark read</button>}
                      {r.status !== 'archived' ? <button className="linkish" formAction={setFeedback.bind(null, r.id, 'archived')}>Archive</button> : <button className="linkish" formAction={setFeedback.bind(null, r.id, 'read')}>Restore</button>}
                    </span>
                  </td>
                  <td className="act"><RowDelete id={r.id} /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="muted">No feedback here yet.</td></tr>}
            </tbody>
          </table></div>
        </BulkForm>
      </Card>
      <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/feedback" params={{ f, tool, visitor }} />
      {open && <FeedbackDrawer id={open} close={href({})} self={(id) => href({ open: id })} />}
    </>
  );
}
