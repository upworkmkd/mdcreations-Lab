import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TOOLS } from '@/lib/tools';
import { UUID_RE } from '@/lib/consent';
import { setFeedback } from '../actions';
import { DeleteOne } from '../bulk';
import { ago, emails, shortId, visitorNames, when } from '../ui';
import { DrawerHelpers } from './drawer-client';

export const FACE = ['', '😞', '🙁', '😐', '🙂', '😍'], WORD = ['', 'Not good', 'Could be better', 'Okay', 'Good', 'Love it'];
export const toolName = (s: string | null) => (s ? TOOLS.find((t) => t.slug === s)?.name ?? s : 'Whole site');
type Fb = { id: string; rating: number; tool_slug: string | null; message: string | null; name: string | null; email: string | null; page: string | null; visitor_id: string | null; user_id: string | null; status: string; user_agent: string | null; created_at: string };

/** One feedback note in a side drawer, over the feedback list. `self` builds a link to the list with another note open. */
export async function FeedbackDrawer({ id, close, self }: { id: string; close: string; self: (id: string) => string }) {
  if (!UUID_RE.test(id)) return null;
  const db = supabaseAdmin();
  const { data } = await db.from('feedback').select('id, rating, tool_slug, message, name, email, page, visitor_id, user_id, status, user_agent, created_at').eq('id', id).maybeSingle();
  const r = data as Fb | null;
  if (!r) return null;
  // everything else this person sent: same browser, same account or same email
  const ors = [r.visitor_id && `visitor_id.eq.${r.visitor_id}`, r.user_id && `user_id.eq.${r.user_id}`, r.email && `email.eq.${r.email}`].filter(Boolean).join(',');
  const [more, names, who] = await Promise.all([
    ors ? db.from('feedback').select('id, rating, message, created_at').or(ors).neq('id', r.id).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] as { id: string; rating: number; message: string | null; created_at: string }[] }),
    r.visitor_id ? visitorNames([r.visitor_id]) : Promise.resolve(new Map<string, string>()),
    r.user_id ? emails([r.user_id]) : Promise.resolve(new Map()),
  ]);
  const acct = r.user_id ? who.get(r.user_id) : null;
  const titleId = `fb-${r.id}`;
  return (
    <div className="adm-drawer-wrap">
      <Link href={close} scroll={false} className="adm-drawer-back" aria-label="Close" />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <DrawerHelpers close={close} id={r.id} unread={r.status === 'new'} />
        <div className="adm-drawer-head">
          <span className="face" aria-hidden>{FACE[r.rating]}</span>
          <div>
            <h2 id={titleId}>{WORD[r.rating]} <span className="muted">· {r.rating}/5</span></h2>
            <p className="muted" title={when(r.created_at)}>{toolName(r.tool_slug)} · {ago(r.created_at)}{r.status === 'archived' ? ' · archived' : ''}</p>
          </div>
          <Link href={close} scroll={false} className="adm-drawer-x" aria-label="Close">×</Link>
        </div>
        <div className="adm-drawer-body">
          <blockquote className="adm-quote">{r.message || <span className="muted">No comment, just the rating.</span>}</blockquote>
          <dl className="adm-facts">
            <div><dt>Name</dt><dd>{r.name || <span className="muted">Not given</span>}</dd></div>
            <div><dt>Email</dt><dd>{r.email ? <a href={`mailto:${r.email}?subject=${encodeURIComponent('Your feedback on MD Creations Labs')}`}>{r.email}</a> : <span className="muted">Not given</span>}</dd></div>
            {acct && <div><dt>Account</dt><dd><Link href={`/admin/users/${r.user_id}`}>{acct.name ? `${acct.name} · ${acct.email}` : acct.email}</Link></dd></div>}
            <div><dt>Visitor</dt><dd>{r.visitor_id ? <Link href={`/admin/visitors/${r.visitor_id}`}>{names.get(r.visitor_id) ?? `Visitor ${shortId(r.visitor_id)}`} →</Link> : <span className="muted">Did not accept analytics cookies</span>}</dd></div>
            <div><dt>Tool</dt><dd>{toolName(r.tool_slug)}</dd></div>
            {r.page && <div><dt>Page</dt><dd><a href={r.page} target="_blank" rel="noreferrer"><code>{r.page}</code> ↗</a></dd></div>}
            <div><dt>Sent</dt><dd>{when(r.created_at)}</dd></div>
          </dl>
          {r.user_agent && <p className="adm-ua">{r.user_agent}</p>}
          <div className="adm-drawer-actions">
            {r.email && <a className="btn small" href={`mailto:${r.email}?subject=${encodeURIComponent('Your feedback on MD Creations Labs')}`}>Reply by email</a>}
            <form action={setFeedback.bind(null, r.id, r.status === 'archived' ? 'read' : 'archived')}><button className="btn small ghost">{r.status === 'archived' ? 'Restore' : 'Archive'}</button></form>
            {r.status !== 'new' && <form action={setFeedback.bind(null, r.id, 'new')}><button className="linkish">Mark unread</button></form>}
            <DeleteOne kind="feedback" id={r.id} label="Delete" after={close} />
          </div>
          {(more.data ?? []).length > 0 && (
            <>
              <h3 className="adm-sub">More from this person</h3>
              <ul className="adm-list">
                {(more.data ?? []).map((m) => (
                  <li key={m.id}><Link href={self(m.id)} scroll={false}>{FACE[m.rating]} {m.message ? m.message.slice(0, 70) + (m.message.length > 70 ? '…' : '') : 'Rating only'}</Link> <span className="muted">· {ago(m.created_at)}</span></li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
