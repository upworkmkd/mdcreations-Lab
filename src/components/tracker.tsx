'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CONSENT_COOKIE, SESSION_COOKIE, SESSION_MINUTES, VISITOR_COOKIE, type Consent } from '@/lib/consent';

/* ------------------------------------------------------------------ cookies */
function getCookie(name: string) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(name: string, value: string, seconds: number) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${seconds}; Path=/; SameSite=Lax${secure}`;
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
}));
const clean = (s: string | null | undefined, n = 80) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/* ------------------------------------------------------------------ the queue (module level, shared with track()) */
type Ev = { type: string; name?: string; path?: string; title?: string; props?: Record<string, unknown>; ts: string };
const state = {
  consent: null as Consent | null,
  queue: [] as Ev[],
  sessionInfo: null as Record<string, string> | null,   // sent with the first batch of a new visit
  ctxSent: false,
  timer: 0 as ReturnType<typeof setTimeout> | 0,
};

function ensureIds() {
  let vid = getCookie(VISITOR_COOKIE);
  if (!vid) vid = uuid();
  setCookie(VISITOR_COOKIE, vid, 60 * 60 * 24 * 400);
  let sid = getCookie(SESSION_COOKIE);
  if (!sid) {
    sid = uuid();
    const u = new URL(location.href), ref = document.referrer;
    let external = '';
    try { if (ref && new URL(ref).host !== location.host) external = ref; } catch { /* ignore */ }
    state.sessionInfo = {
      referrer: external, landing: location.pathname + location.search,
      utm_source: u.searchParams.get('utm_source') ?? '', utm_medium: u.searchParams.get('utm_medium') ?? '',
      utm_campaign: u.searchParams.get('utm_campaign') ?? '', utm_term: u.searchParams.get('utm_term') ?? '',
      utm_content: u.searchParams.get('utm_content') ?? '',
    };
  }
  setCookie(SESSION_COOKIE, sid, SESSION_MINUTES * 60);   // sliding: every batch keeps the visit alive
}

function context() {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string } };
  return {
    lang: n.language, langs: (n.languages ?? []).join(','), tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}`, viewport: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio,
    scheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    touch: 'ontouchstart' in window || n.maxTouchPoints > 0, cores: n.hardwareConcurrency ?? null,
    memory: n.deviceMemory ?? null, net: n.connection?.effectiveType ?? null,
  };
}

function flush(beacon = false) {
  if (state.timer) { clearTimeout(state.timer); state.timer = 0; }
  if (state.consent !== 'all' || !state.queue.length) return;
  ensureIds();
  const body: Record<string, unknown> = { events: state.queue.splice(0, 80) };
  if (!state.ctxSent) { body.ctx = context(); state.ctxSent = true; }
  if (state.sessionInfo) { body.session = state.sessionInfo; state.sessionInfo = null; }
  const json = JSON.stringify(body);
  if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([json], { type: 'application/json' }));
  else fetch('/api/track', { method: 'POST', body: json, headers: { 'Content-Type': 'application/json' }, keepalive: json.length < 60_000 }).catch(() => {});
  if (state.queue.length) flush(beacon);
}

/** Records one thing the visitor did. Safe to call anywhere; does nothing without analytics consent. */
export function track(type: string, name?: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined' || state.consent === 'essential') return;
  if (location.pathname.startsWith('/admin')) return;
  state.queue.push({ type, name, path: location.pathname + location.search, title: document.title, props, ts: new Date().toISOString() });
  if (state.queue.length > 120) state.queue.splice(0, state.queue.length - 120);
  if (state.consent !== 'all') return;                     // waits for the answer to the cookie question
  if (state.queue.length >= 15) flush();
  else if (!state.timer) state.timer = setTimeout(() => flush(), 4000);
}

/* ------------------------------------------------------------------ automatic capture */
function labelFor(el: Element) {
  const id = el.getAttribute('id');
  const lab = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest('label');
  return clean(lab?.textContent ?? el.getAttribute('aria-label') ?? el.getAttribute('name') ?? id, 60);
}

function onClick(e: MouseEvent) {
  const t = e.target as Element | null;
  const el = t?.closest?.('a, button, [role="button"], summary, [data-track]');
  if (!el || el.closest('[data-notrack]')) return;
  const a = el.closest('a') as HTMLAnchorElement | null;
  const name = clean(el.getAttribute('data-track') ?? el.getAttribute('aria-label') ?? (el as HTMLElement).innerText ?? el.textContent);
  const props: Record<string, unknown> = { tag: el.tagName.toLowerCase() };
  if (el.id) props.id = el.id;
  if (a?.href) { props.href = a.getAttribute('href'); try { if (new URL(a.href).host !== location.host) props.outbound = true; } catch { /* ignore */ } }
  track(props.outbound ? 'outbound' : 'click', name || props.id as string || props.tag as string, props);
}

function onChange(e: Event) {
  const el = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (!el || !('type' in el) || el.closest('[data-notrack]')) return;
  const type = el.type, name = labelFor(el), props: Record<string, unknown> = { field: el.id || el.name || undefined, kind: type };
  if (type === 'password' || type === 'email' || type === 'tel') return;    // never record these
  if (type === 'file') {
    const f = (el as HTMLInputElement).files?.[0];
    if (f) track('file', name || 'file chosen', { ...props, type: f.type, kb: Math.round(f.size / 1024), ext: f.name.split('.').pop()?.toLowerCase() });
    return;
  }
  if (type === 'checkbox' || type === 'radio') props.value = (el as HTMLInputElement).checked;
  else if (el.tagName === 'SELECT') props.value = clean((el as HTMLSelectElement).selectedOptions[0]?.text ?? el.value, 80);
  else if (type === 'range' || type === 'number') props.value = el.value;
  else props.value = clean(el.value, 40);   // short free text, such as a design name
  track('input', name || props.field as string, props);
}

function onSubmit(e: Event) {
  const f = e.target as HTMLFormElement | null;
  if (!f || f.closest('[data-notrack]')) return;
  const btn = f.querySelector('button[type="submit"], button:not([type])');
  track('submit', clean(f.getAttribute('aria-label') ?? f.id ?? '') || clean((btn as HTMLElement | null)?.innerText) || 'form', { fields: f.elements.length });
}

/* ------------------------------------------------------------------ the stored answer, as an external store */
const CHANGED = 'mdl:consent-changed';
const readConsent = (): Consent | 'none' => { const c = getCookie(CONSENT_COOKIE); return c === 'all' || c === 'essential' ? c : 'none'; };
const subscribe = (cb: () => void) => { addEventListener(CHANGED, cb); return () => removeEventListener(CHANGED, cb); };

/* ------------------------------------------------------------------ component */
export function Tracker() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribe, readConsent, () => 'ssr' as const);
  const [asking, setAsking] = useState(false);
  const page = useRef<{ path: string; start: number; scroll: number } | null>(null);
  const errors = useRef(0);

  // keep the tracker in step with the answer to the cookie question
  useEffect(() => {
    if (consent === 'ssr') return;
    state.consent = consent === 'none' ? null : consent;
    if (consent === 'all') flush();
  }, [consent]);

  // wire up listeners once
  useEffect(() => {
    const onScroll = () => {
      if (!page.current) return;
      const h = document.documentElement, max = h.scrollHeight - innerHeight;
      const pct = max > 0 ? Math.round((scrollY / max) * 100) : 100;
      if (pct > page.current.scroll) page.current.scroll = Math.min(100, pct);
    };
    const leave = () => {
      if (page.current) track('leave', page.current.path, { seconds: Math.round((Date.now() - page.current.start) / 1000), scroll: page.current.scroll });
      page.current = null;
    };
    const onHide = () => { if (document.visibilityState === 'hidden') { leave(); flush(true); } else if (!page.current) page.current = { path: location.pathname + location.search, start: Date.now(), scroll: 0 }; };
    const onPageHide = () => { leave(); flush(true); };
    const onError = (ev: ErrorEvent | PromiseRejectionEvent) => {
      if (errors.current++ >= 5) return;
      const msg = 'message' in ev ? ev.message : String((ev as PromiseRejectionEvent).reason?.message ?? (ev as PromiseRejectionEvent).reason);
      track('error', clean(msg, 150), 'filename' in ev ? { src: ev.filename?.slice(-80), line: ev.lineno } : {});
    };
    const reopen = () => setAsking(true);
    (window as unknown as { mdTrack: typeof track }).mdTrack = track;
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('visibilitychange', onHide);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('pagehide', onPageHide);
    addEventListener('error', onError);
    addEventListener('unhandledrejection', onError);
    addEventListener('mdl:consent', reopen);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('visibilitychange', onHide);
      removeEventListener('scroll', onScroll);
      removeEventListener('pagehide', onPageHide);
      removeEventListener('error', onError);
      removeEventListener('unhandledrejection', onError);
      removeEventListener('mdl:consent', reopen);
    };
  }, []);

  // a page view on every route change, with time spent and scroll depth for the page before
  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    const prev = page.current;
    if (prev) track('leave', prev.path, { seconds: Math.round((Date.now() - prev.start) / 1000), scroll: prev.scroll });
    const path = location.pathname + location.search;
    page.current = { path, start: Date.now(), scroll: 0 };
    const from = prev?.path ?? (document.referrer || undefined);
    const t = setTimeout(() => track('pageview', document.title, { from }), 250);   // the title updates just after navigation
    return () => clearTimeout(t);
  }, [pathname]);

  const choose = (v: Consent) => {
    setCookie(CONSENT_COOKIE, v, 60 * 60 * 24 * 365);
    state.consent = v;
    setAsking(false);
    dispatchEvent(new Event(CHANGED));
    if (v === 'all') { track('consent', 'Accepted analytics cookies'); flush(); }
    else {
      state.queue.length = 0;
      setCookie(VISITOR_COOKIE, '', 0);
      setCookie(SESSION_COOKIE, '', 0);
    }
  };

  if (consent === 'ssr' || (consent !== 'none' && !asking) || pathname.startsWith('/admin')) return null;
  return (
    <div className="consent" role="dialog" aria-live="polite" aria-label="Cookie choices" data-notrack>
      <p><b>Cookies.</b> We use essential cookies to keep you signed in and remember your currency. With your OK we also record how the site is used (pages, clicks, device, browser and approximate location) so we can make the tools better. <Link href="/privacy">Privacy policy</Link></p>
      <div className="consent-btns">
        <button type="button" className="btn small ghost" onClick={() => choose('essential')}>Essential only</button>
        <button type="button" className="btn small" onClick={() => choose('all')}>Accept all</button>
      </div>
    </div>
  );
}

/** Footer link that opens the cookie question again. */
export function CookieSettings() {
  return <button type="button" className="linkish" onClick={() => dispatchEvent(new Event('mdl:consent'))}>Cookie settings</button>;
}
