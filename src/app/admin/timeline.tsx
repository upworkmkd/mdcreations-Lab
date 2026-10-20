import Link from 'next/link';
import { clock, day, duration, money } from './ui';
import { RowDelete, Sel } from './bulk';

export type Ev = { id: number; visitor_id: string; session_id: string | null; user_id: string | null; type: string; name: string | null; path: string | null; title: string | null; props: Record<string, unknown>; created_at: string };
export type Sess = { id: string; started_at: string; last_seen: string; pageviews: number; events: number; referrer: string | null; landing: string | null; browser: string | null; os: string | null; device_type: string | null; city: string | null; country: string | null; ip: string | null; utm_source: string | null; utm_campaign: string | null };

const KEY = new Set(['subscribed', 'plan_build', 'subscription_cancel', 'signup', 'signin', 'email_confirmed', 'design_saved', 'checkout', 'payment', 'payment_done', 'download', 'review']);
const BAD = new Set(['subscribe_error', 'error', 'purchase_error', 'signin_failed', 'payment_cancelled']);

const q = (s: unknown) => `“${String(s ?? '')}”`;
const p = (e: Ev, k: string) => e.props?.[k] as string | number | boolean | undefined;

function describe(e: Ev): { icon: string; text: React.ReactNode } {
  const n = e.name ?? '';
  switch (e.type) {
    case 'pageview': return { icon: '◉', text: <>Viewed <b>{e.title?.replace(/ \| MD Creations Labs$/, '') || e.path}</b></> };
    case 'leave': return { icon: '◌', text: <>Spent {duration(Number(p(e, 'seconds') ?? 0))} on <code>{n || e.path}</code>, scrolled {p(e, 'scroll') ?? 0}%</> };
    case 'click': return { icon: '↘', text: <>Clicked {q(n)}{p(e, 'href') ? <> → <code>{String(p(e, 'href'))}</code></> : null}</> };
    case 'outbound': return { icon: '↗', text: <>Left for {q(n)} <code>{String(p(e, 'href') ?? '')}</code></> };
    case 'input': return { icon: '⚙', text: <>Set {q(n)} to <b>{String(p(e, 'value') ?? '')}</b></> };
    case 'file': return { icon: '⬆', text: <>Chose a picture ({String(p(e, 'ext') ?? '?')}, {String(p(e, 'kb') ?? '?')} KB)</> };
    case 'submit': return { icon: '✓', text: <>Submitted the form {q(n)}</> };
    case 'consent': return { icon: '✓', text: <>Accepted analytics cookies</> };
    case 'signup': return { icon: '★', text: <>Created an account <b>{n}</b>{p(e, 'confirmed') === false ? ' (email not confirmed yet)' : ''}</> };
    case 'email_confirmed': return { icon: '★', text: <>Confirmed their email <b>{n}</b></> };
    case 'signin': return { icon: '→', text: <>Signed in as <b>{n}</b></> };
    case 'signin_failed': return { icon: '!', text: <>Sign-in failed: {String(p(e, 'reason') ?? '')}</> };
    case 'signout': return { icon: '←', text: <>Signed out</> };
    case 'password_reset': return { icon: '→', text: <>Opened a password reset link</> };
    case 'design_saved': return { icon: '◆', text: <>Saved the design <b>{q(n)}</b></> };
    case 'checkout': return { icon: '₹', text: <>Started checkout for {q(n)}, {money(Number(p(e, 'amount') ?? 0), String(p(e, 'currency') ?? 'INR'))}</> };
    case 'payment_done': return { icon: '₹', text: <>Finished paying in Razorpay</> };
    case 'payment_cancelled': return { icon: '×', text: <>Closed the payment window without paying</> };
    case 'payment': return { icon: '₹', text: <><b>Paid</b> {money(Number(p(e, 'amount') ?? 0), String(p(e, 'currency') ?? 'INR'))} · files built</> };
    case 'purchase_error': return { icon: '!', text: <>Purchase problem: {n}</> };
    case 'download': return { icon: '⬇', text: <>Downloaded <b>{n}</b></> };
    case 'subscribe_start': return { icon: '↻', text: <>Started subscribing to the <b>{n}</b></> };
    case 'subscribed': return { icon: '↻', text: <><b>Subscribed</b> to the {n}, paid {money(Number(p(e, 'amount') ?? 0), String(p(e, 'currency') ?? 'INR'))}</> };
    case 'subscribe_cancelled': return { icon: '×', text: <>Closed the subscription payment window ({n})</> };
    case 'subscribe_error': return { icon: '!', text: <>Subscription problem: {n}</> };
    case 'subscription_cancel': return { icon: '×', text: <>Cancelled their {n} (stays active until the end of the month)</> };
    case 'plan_build': return { icon: '◆', text: <>Built {q(n)} with their plan{p(e, 'left') != null ? `, ${p(e, 'left')} left today` : ''}</> };
    case 'chooser_open': return { icon: '?', text: <>Opened the download options</> };
    case 'chooser_pick': return { icon: '→', text: <>Chose <b>{n}</b></> };
    case 'review': return { icon: '❝', text: <>Wrote a review</> };
    case 'error': return { icon: '!', text: <>Page error: <code>{n}</code></> };
    default: return { icon: '·', text: <>{e.type}{n ? `: ${n}` : ''}</> };
  }
}

/** The activity timeline: days, then visits (sessions), then each thing they did. */
export function Timeline({ events, sessions = [], showVisitor, names, selectable }: { events: Ev[]; sessions?: Sess[]; showVisitor?: boolean; names?: Map<string, string>; selectable?: boolean }) {
  if (!events.length) return <p className="adm-empty">No activity recorded yet.</p>;
  const sMap = new Map(sessions.map((s) => [s.id, s]));
  const groups: { key: string; sid: string | null; day: string; items: Ev[] }[] = [];
  for (const e of events) {
    const d = day(e.created_at), last = groups[groups.length - 1];
    if (last && last.sid === e.session_id && last.day === d) last.items.push(e);
    else groups.push({ key: `${e.session_id}-${e.id}`, sid: e.session_id, day: d, items: [e] });
  }
  let lastDay = '';
  return (
    <div className="adm-tl">
      {groups.map((g) => {
        const s = g.sid ? sMap.get(g.sid) : undefined;
        const showDay = g.day !== lastDay; lastDay = g.day;
        return (
          <div key={g.key}>
            {showDay && <h3 className="adm-tl-day">{g.day}</h3>}
            <div className="adm-tl-visit">
              <div className="adm-tl-vhead">
                <span>Visit {s ? <>at {clock(s.started_at)} · {duration((new Date(s.last_seen).getTime() - new Date(s.started_at).getTime()) / 1000)} · {s.pageviews} pages</> : null}</span>
                {s && <span className="muted">{[s.device_type, s.browser, s.os].filter(Boolean).join(' · ')}{s.city ? ` · ${s.city}` : ''}{s.referrer ? ` · from ${s.referrer.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}` : ''}{s.utm_source ? ` · utm ${s.utm_source}` : ''}</span>}
                {showVisitor && <Link href={`/admin/visitors/${g.items[0].visitor_id}`} className="adm-tl-who">{names?.get(g.items[0].visitor_id) ?? `Visitor #${g.items[0].visitor_id.slice(0, 6)}`}</Link>}
              </div>
              <ol>
                {g.items.map((e) => {
                  const d = describe(e);
                  return (
                    <li key={e.id} className={`t-${e.type}${KEY.has(e.type) ? ' key' : ''}${BAD.has(e.type) ? ' bad' : ''}`}>
                      {selectable && <span className="sel"><Sel id={String(e.id)} /></span>}
                      <time>{clock(e.created_at)}</time>
                      <span className="ic" aria-hidden>{d.icon}</span>
                      <span className="tx">{d.text}{e.type !== 'pageview' && e.type !== 'leave' && e.path ? <span className="where"> on {e.path}</span> : e.type === 'pageview' ? <span className="where"> {e.path}</span> : null}</span>
                      {selectable && <span className="act"><RowDelete id={String(e.id)} /></span>}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const NOISE = ['leave', 'input', 'click'];
