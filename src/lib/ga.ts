/* Google Analytics 4 (labs.themdcreations.com property). Browser-only helpers.
 *
 * GA is loaded only after "Accept all" on the cookie question, and never on admin pages or on browsers used by the
 * shop owner (see GoogleAnalytics in components/google-analytics.tsx). Without that answer nothing is sent to Google:
 * page views are still counted by our own cookieless counter.
 *
 * Events use Google's recommended names where one exists (page_view, sign_up, login, view_item, begin_checkout,
 * purchase), so the standard GA reports (Monetisation, Engagement, Acquisition) fill in by themselves. */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? 'G-DZL98J94N7';
export const GA_QUEUE_COOKIE = 'mdl_ga';   // events the server hands over (sign-up, payment …), read once by the browser

type Gtag = (...args: unknown[]) => void;
type W = Window & { gtag?: Gtag; dataLayer?: unknown[]; __gaOn?: boolean };
const pending: [string, Record<string, unknown>][] = [];

/** Sends one event to GA, or keeps it until GA is loaded (it is dropped if the visitor never accepts analytics). */
export function gaEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const w = window as W;
  const clean = Object.fromEntries(Object.entries({ ...params, ...toolOf() }).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  if (w.__gaOn && w.gtag) w.gtag('event', name, clean);
  else if (pending.length < 40) pending.push([name, clean]);
}
/** Called once GA has been set up: sends what was waiting. */
export function gaFlushPending() { const w = window as W; while (pending.length && w.gtag) { const [n, p] = pending.shift()!; w.gtag('event', n, p); } }
export function gaDropPending() { pending.length = 0; }

/** The tool the visitor is on, from the address: /tools/<slug>… */
function toolOf(): { tool?: string } {
  const m = location.pathname.match(/^\/tools\/([a-z0-9-]+)/);
  return m ? { tool: m[1] } : {};
}

/* ------------------------------------------------------------------ our own event names → GA events
 * The site already records what visitors do with track(type, name, props) (components/tracker.tsx). The ones worth
 * reporting in GA are forwarded from there, so the tools need no GA code of their own. */
export function gaFromTrack(type: string, name: string | undefined, props: Record<string, unknown> = {}) {
  switch (type) {
    case 'free_download': return gaEvent('free_download', { tool: name, format: props.format, item_name: name });
    case 'sample_download': return gaEvent('sample_download', { item_name: name, placement: props.where });
    case 'video_play': return gaEvent('tutorial_play', { video_title: name, placement: props.where });
    case 'what_you_get': return gaEvent('view_what_you_get', { tool: name });
    case 'print_open': return gaEvent('print_order_open', { item_name: name });
    case 'chooser_open': return gaEvent('view_download_options', {});
    case 'chooser_pick': return gaEvent('select_download_option', { option: name });
    case 'guide_open': return gaEvent('picture_guide_open', {});
    case 'payment_cancelled': return gaEvent('checkout_cancelled', { order_kind: props.kind ?? 'download' });
    case 'purchase_error': return gaEvent('checkout_error', { error_message: String(name ?? '').slice(0, 100), order_kind: props.kind ?? 'download' });
    case 'subscribe_cancelled': return gaEvent('checkout_cancelled', { order_kind: 'plan', plan: name });
    case 'upload_rejected': return gaEvent('upload_rejected', { reason: String(name ?? '').slice(0, 100) });
    case 'image_stl_upload': return gaEvent('upload_picture', { file_type: name });
    case 'file': if (location.pathname.startsWith('/tools/')) return gaEvent('upload_picture', { file_type: props.ext }); return;
    case 'studio_template': return gaEvent('studio_template', { template: name });
    case 'consent': return;
  }
}

/** Page-based events: opening a maker or a shop product is "viewing an item" in GA's terms. */
let lastPage = '';
export function gaPageEvents(path: string, title: string) {
  if (path === lastPage) return; lastPage = path;   // once per page
  const make = path.match(/^\/tools\/([a-z0-9-]+)\/(make|calculator)\/?$/), stl = path.match(/^\/stl-files\/([a-z0-9-]+)\/?$/);
  const name = title.split(/\s[–|-]\s/)[0].slice(0, 100);
  if (make) gaEvent('view_item', { items: [{ item_id: make[1], item_name: name, item_category: 'tool' }] });
  else if (stl) gaEvent('view_item', { items: [{ item_id: `stl-${stl[1]}`, item_name: name, item_category: 'stl' }] });
  else if (path === '/pricing') gaEvent('view_plans', {});
}

/** Events the server left in a cookie (sign-up, checkout, payment …): sent once, then the cookie is cleared. */
export function gaDrainServerQueue() {
  const m = document.cookie.match(new RegExp('(?:^|; )' + GA_QUEUE_COOKIE + '=([^;]*)'));
  if (!m) return;
  document.cookie = `${GA_QUEUE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  try {
    const list = JSON.parse(decodeURIComponent(m[1])) as [string, Record<string, unknown>][];
    for (const [n, p] of Array.isArray(list) ? list.slice(0, 10) : []) if (typeof n === 'string') gaEvent(n, p ?? {});
  } catch { /* ignore */ }
}
