'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

/* "How do you like it?" — a small card in the corner, not a blocking dialog.
 * It opens by itself once, about 15 seconds after a visitor's first landing (after the cookie banner is answered).
 * Sent → never again. Closed → again after 3 days, and not after the third time. The footer link opens it any time.
 * The choice lives in the mdl_fb cookie: 'done' or 'later:<times closed>:<when>'. */

const COOKIE = 'mdl_fb', OPEN_EVENT = 'mdl:feedback', DELAY_MS = 15_000, AGAIN_DAYS = 3, MAX_CLOSES = 3;
const FACES: [number, string, string][] = [[1, '😞', 'Not good'], [2, '🙁', 'Could be better'], [3, '😐', 'Okay'], [4, '🙂', 'Good'], [5, '😍', 'Love it']];
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

type TurnstileApi = { render(el: HTMLElement, o: { sitekey: string; callback(t: string): void; 'expired-callback'(): void; theme?: string }): string; reset(id?: string): void };
declare global { interface Window { turnstile?: TurnstileApi } }

function readState(): { done: boolean; closes: number; at: number } {
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? '';
  if (raw === 'done') return { done: true, closes: 0, at: 0 };
  const [, n, at] = decodeURIComponent(raw).split(':');
  return { done: false, closes: Number(n) || 0, at: Number(at) || 0 };
}
function writeState(v: string) {
  document.cookie = `${COOKIE}=${encodeURIComponent(v)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}
const consentAnswered = () => document.cookie.split('; ').some((c) => c.startsWith('mdl_consent='));

/** Opens the feedback card (used by the "Give feedback" link in the footer). */
export function openFeedback() { window.dispatchEvent(new Event(OPEN_EVENT)); }

export function FeedbackLink({ className = 'linkish' }: { className?: string }) {
  return <button type="button" className={className} onClick={openFeedback}>Give feedback</button>;
}

export function FeedbackPopup({ tools }: { tools: [string, string][] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [tool, setTool] = useState('');
  const [form, setForm] = useState({ message: '', name: '', email: '', website: '' });
  const [token, setToken] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null), cf = useRef<HTMLDivElement>(null), cfId = useRef<string | null>(null);
  const titleId = useId();
  const pathTool = path.match(/^\/tools\/([a-z0-9-]+)/)?.[1] ?? '';

  const show = useCallback((byHand: boolean) => {
    setOpen(true); setState('idle'); setError('');
    setTool((t) => t || (tools.some(([s]) => s === pathTool) ? pathTool : ''));
    fetch('/api/feedback', { cache: 'no-store' }).then((r) => r.json()).then((j: { token?: string }) => setToken(j.token ?? '')).catch(() => {});
    if (byHand) setTimeout(() => box.current?.querySelector<HTMLElement>('button.face')?.focus(), 50);
  }, [pathTool, tools]);

  // opens by itself once, a while after landing, when the visitor has not answered or asked us to wait
  useEffect(() => {
    if (path.startsWith('/admin')) return;
    const s = readState();
    if (s.done || s.closes >= MAX_CLOSES || (s.at && Date.now() - s.at < AGAIN_DAYS * 86400_000)) return;
    let waited = 0, timer = 0;
    const tick = () => {
      if (document.visibilityState === 'visible' && consentAnswered()) waited += 1000;
      if (waited >= DELAY_MS) { show(false); return; }
      timer = window.setTimeout(tick, 1000);
    };
    timer = window.setTimeout(tick, 1000);
    return () => clearTimeout(timer);
    // only on the first page of the visit; moving between pages must not restart the wait
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { const h = () => show(true); window.addEventListener(OPEN_EVENT, h); return () => window.removeEventListener(OPEN_EVENT, h); }, [show]);

  // Cloudflare Turnstile, only when its site key is set
  useEffect(() => {
    if (!open || !SITE_KEY || rating === 0 || state === 'sent') return;
    let tries = 0;
    const t = setInterval(() => {
      if (window.turnstile && cf.current && !cfId.current) {
        cfId.current = window.turnstile.render(cf.current, { sitekey: SITE_KEY, theme: 'light', callback: setCaptcha, 'expired-callback': () => setCaptcha('') });
      }
      if (cfId.current || ++tries > 40) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [open, rating, state]);

  const close = () => {
    setOpen(false);
    if (state !== 'sent') { const s = readState(); if (!s.done) writeState(`later:${s.closes + 1}:${Date.now()}`); }
    cfId.current = null; setCaptcha('');
  };
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) { setError('Pick how you feel first.'); return; }
    if (SITE_KEY && !captcha) { setError('Please complete the check below.'); return; }
    setState('sending'); setError('');
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, tool, ...form, page: path, token, turnstile: captcha }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) { setState('error'); setError(j.error || 'Could not send it just now. Please try again.'); if (cfId.current) window.turnstile?.reset(cfId.current); setCaptcha(''); return; }
      writeState('done'); setState('sent');
      setTimeout(() => setOpen(false), 4000);
    } catch { setState('error'); setError('Could not send it just now. Please try again.'); }
  };

  if (!open || path.startsWith('/admin')) return null;
  const hint = rating && rating <= 2 ? 'What went wrong, or what was missing?' : rating === 3 ? 'What would make it better?' : 'What do you like, and what could be better?';
  return (
    <>
      {SITE_KEY && rating > 0 && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />}
      <div ref={box} className="fb-card" role="dialog" aria-modal="false" aria-labelledby={titleId}>
        <button type="button" className="fb-x" aria-label="Close" onClick={close}>×</button>
        {state === 'sent' ? (
          <div className="fb-thanks" role="status"><span aria-hidden>🙏</span><p><b>Thank you!</b> Every note is read, and it shapes what we build next.</p></div>
        ) : (
          <form onSubmit={send} noValidate>
            <p className="fb-eyebrow">Quick feedback</p>
            <h2 id={titleId}>How do you like MD Creations Labs?</h2>
            <div className="fb-faces" role="radiogroup" aria-label="How do you feel about it">
              {FACES.map(([n, face, label]) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} className={`face${rating === n ? ' on' : ''}`} onClick={() => { setRating(n); setError(''); }} title={label}>
                  <span aria-hidden>{face}</span><small>{label}</small>
                </button>
              ))}
            </div>
            {rating > 0 && (
              <div className="fb-more">
                <label className="fb-field"><span>Which tool?</span>
                  <select className="input" value={tool} onChange={(e) => setTool(e.target.value)}>
                    <option value="">The whole site</option>
                    {tools.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
                  </select>
                </label>
                <label className="fb-field"><span>{hint}</span>
                  <textarea className="input" rows={3} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Your thoughts, ideas or a tool you wish we had" />
                </label>
                <div className="fb-row">
                  <label className="fb-field"><span>Name <i>optional</i></span><input className="input" maxLength={80} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                  <label className="fb-field"><span>Email <i>optional</i></span><input className="input" type="email" maxLength={160} autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="So we can reply" /></label>
                </div>
                {/* a field people never see; bots fill it in */}
                <label className="fb-hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
                {SITE_KEY && <div ref={cf} className="fb-captcha" />}
                {error && <p className="fb-err" role="alert">{error}</p>}
                <div className="fb-actions">
                  <button type="submit" className="btn small" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send feedback'}</button>
                  <button type="button" className="linkish" onClick={close}>Not now</button>
                </div>
                <p className="fb-note">We use your email only to reply to you.</p>
              </div>
            )}
            {rating === 0 && error && <p className="fb-err" role="alert">{error}</p>}
          </form>
        )}
      </div>
    </>
  );
}
